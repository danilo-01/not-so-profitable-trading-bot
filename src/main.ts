import axios, { AxiosRequestConfig } from "axios";
import { AlpacaStockData, AlpacaStockQuote } from "./types";
import "dotenv/config";
import {
  readdir,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "fs";
import path from "path";
import { makeRequestWithRetry } from "./helpers";

const {
  ALPACA_SECRET_KEY,
  ALPACA_API_KEY,
  ALPACA_PAPER_API_URL,
  POLYGON_API_KEY,
  POLYGON_API_URL,
} = process.env;

interface StockData {
  ticker: string;
  todaysChangePerc: number;
  relativeVolume: number;
  volume: number;
  boughtChangePerc?: number;
  soldChangePerc?: number;
  highestChangePerc: number;
  //   updated: number;
}

const stockData: Map<string, StockData> = new Map();
const boughtStocks: Set<string> = new Set();
const stocksToIgnore: Set<string> = new Set();
let moneyEarned = 0;
let moneySpent = 0;
const trackedPercentages: number[] = [];
const trackedMovement: string[] = [];

async function main() {
  // Logitc to fetch stock data and iterate over data
  // There needs to be a data structure that tracks all stock data throughout the day
  setInterval(async () => {
    // Fetch snapshot data
    const { data: snapshotData } = await makeRequestWithRetry({
      method: "get",
      url: `${POLYGON_API_URL}/v2/snapshot/locale/us/markets/stocks/tickers?apiKey=${POLYGON_API_KEY}`,
    });

    // If data could not be fetched return and log response
    if (snapshotData.status !== "OK") {
      console.log("Could not fetch snapshot data ", snapshotData);
      return;
    }

    // Iterate over snapshot data
    for (const ticker of snapshotData.tickers) {
      // Update collected stock data

      let stockDataReference = stockData.get(ticker.ticker);

      // If stock data doesnt exist add it to store
      if (!stockDataReference)
        stockData.set(ticker.ticker, {
          ticker: ticker.ticker,
          todaysChangePerc: 0,
          relativeVolume: 0,
          volume: 0,
          highestChangePerc: 0,
        });

      stockDataReference = stockData.get(ticker.ticker);

      //   Update todays change percentage
      stockDataReference!.todaysChangePerc = ticker.todaysChangePerc;
    }

    // Fetch group data
    const aggregateWindowStartDate = "2024-07-09";
    const { data: groupedData } = await makeRequestWithRetry({
      method: "get",
      url: `${POLYGON_API_URL}/v2/aggs/grouped/locale/us/market/stocks/${aggregateWindowStartDate}?apiKey=${POLYGON_API_KEY}`,
    });

    // If data could not be fetched return and log response
    if (groupedData.status !== "OK") {
      console.log("Could not fetch group data ", groupedData);
      return;
    }

    // Iterate over group data
    for (const result of groupedData.results) {
      // Update collected stock data

      let stockDataReference = stockData.get(result.T);

      // If stock data doesnt exist add it to store
      if (!stockDataReference)
        stockData.set(result.T, {
          ticker: result.T,
          todaysChangePerc: 0,
          relativeVolume: 0,
          volume: 0,
          highestChangePerc: 0,
        });

      stockDataReference = stockData.get(result.T);

      //   Update relative volume
      stockDataReference!.relativeVolume = result.v / result.vw;
      stockDataReference!.volume = result.v;
    }

    // Clean up stock data
    for (const tickerSymbol of stockData.keys()) {
      const stockDataReference = stockData.get(tickerSymbol);

      if (!stockDataReference) continue;

      //   Remove stock data if there is no volume
      if (stockDataReference.volume === 0) {
        stockData.delete(tickerSymbol);
      }

      //   Remove stocks that have more than 10 million shares

      //   TODO - add logic to remove stocks less than 1 dollar and more than 20 dollars
    }

    // Run algo 1
    momentumAlgo();
  }, 5000);
}

// Function to determine if a stock is worth BUYING or SELLING
// this is where the algorithm can change, we can make a few algorithms to do this

// Function to BUY  a stock

// Function to SELL a stock

main();

async function momentumAlgo() {
  const consoleResponse = {
    stocksBought: [] as string[],
    stocksSold: [] as {
      symbol: string;
      boughtAt: number;
      soldAt: number;
    }[],
  };

  for (const data of Array.from(stockData.values())) {
    if (stocksToIgnore.has(data.ticker)) continue;

    if (data.todaysChangePerc > data.highestChangePerc) {
      // Update stocks highest percentage
      data.highestChangePerc = data.todaysChangePerc;
    }
    if (!boughtStocks.has(data.ticker)) {
      // Buy condition: If the relative volume is high and the stock is up significantly
      if (data.relativeVolume > 5 && data.todaysChangePerc > 10) {
        stockData.get(data.ticker)!.boughtChangePerc = data.todaysChangePerc;
        buyStock(data.ticker, 20);

        consoleResponse.stocksBought.push(data.ticker);
      }
    }
  }
  let totalPercent = 0;
  for (const tickerSymbol of boughtStocks) {
    const stockDataReference = stockData.get(tickerSymbol);

    totalPercent +=
      stockDataReference!.todaysChangePerc -
      stockDataReference!.boughtChangePerc!;
  }
  trackedPercentages.push(totalPercent);

  for (let i = 0; i < trackedPercentages.length; i++) {
    if (i === 0) continue;

    if (trackedPercentages[i] > trackedPercentages[i - 1]) {
      trackedMovement.push("UP");
    } else if (trackedPercentages[i] > trackedPercentages[i - 1]) {
      trackedMovement.push("SAME");
    } else {
      trackedMovement.push("DOWN");
    }
  }

  console.log("Total percent earned: ", totalPercent);

  if (totalPercent > 0) {
    console.log("selling all stocks");
    await sellAllStocks();
    boughtStocks.clear();
  }
}

function calculateSellThreshold(
  highestChangePerc: number,
  boughtPerc: number
): number {
  if (highestChangePerc >= boughtPerc + 20) {
    return highestChangePerc - 1; // Tighten the stop to 1% below the highest percentage
  } else if (highestChangePerc >= boughtPerc + 15) {
    return highestChangePerc - 2; // 2% below for a slightly lower gain
  } else if (highestChangePerc >= boughtPerc + 10) {
    return highestChangePerc - 3; // 3% below for moderate gains
  } else {
    return highestChangePerc - 5; // 5% below for lower gains
  }
}

// async function meanReversionAlgo() {
//     stockData.forEach((data) => {
//       if (data.currentPrice < data.movingAverage50 * 0.95) {
//         // Buy if price is significantly below 50-day moving average
//         buyStock(data.ticker);
//       } else if (data.currentPrice > data.movingAverage50 * 1.05) {
//         // Sell if price is significantly above 50-day moving average
//         sellStock(data.ticker);
//       }
//     });
//   }

//   async function breakoutAlgo() {
//     stockData.forEach((data) => {
//       if (data.currentPrice > data.highPrice && data.relativeVolume > 2) {
//         // Buy if price breaks above previous high with strong volume
//         buyStock(data.ticker);
//       } else if (data.currentPrice < data.lowPrice) {
//         // Sell if price falls below previous low
//         sellStock(data.ticker);
//       }
//     });
//   }

async function buyStock(tickerSymbol: string, notionalAmount: number) {
  try {
    const response = await makeRequestWithRetry({
      method: "post",
      headers: {
        "APCA-API-KEY-ID": ALPACA_API_KEY,
        "APCA-API-SECRET-KEY": ALPACA_SECRET_KEY,
      },
      data: {
        symbol: tickerSymbol, // The stock ticker symbol you want to buy
        notional: notionalAmount, // The dollar amount you want to invest
        side: "buy", // The order side ('buy' or 'sell')
        type: "market", // The order type ('market', 'limit', etc.)
        time_in_force: "day", // Order time in force ('day', 'gtc', etc.)
      },

      url: `${ALPACA_PAPER_API_URL}/v2/orders`,
    });

    console.log("Order successful:", tickerSymbol);

    boughtStocks.add(tickerSymbol);
    moneySpent += notionalAmount;
  } catch (error: any) {
    stocksToIgnore.add(tickerSymbol);
    console.error(
      `Error placing order: `,
      error.response ? error.response.data : error.message
    );
  }
}

async function sellStock(tickerSymbol: string, quantity?: number) {
  try {
    // Fetch current position to determine the quantity to sell if not provided
    if (!quantity) {
      const positionResponse = await makeRequestWithRetry({
        method: "get",
        headers: {
          "APCA-API-KEY-ID": ALPACA_API_KEY,
          "APCA-API-SECRET-KEY": ALPACA_SECRET_KEY,
        },
        url: `${ALPACA_PAPER_API_URL}/v2/positions/${tickerSymbol}`,
      });

      quantity = positionResponse.data.qty;
    }

    // Place sell order
    const response = await makeRequestWithRetry({
      method: "post",
      headers: {
        "APCA-API-KEY-ID": ALPACA_API_KEY,
        "APCA-API-SECRET-KEY": ALPACA_SECRET_KEY,
      },
      data: {
        symbol: tickerSymbol, // The stock ticker symbol you want to sell
        qty: quantity, // The number of shares you want to sell
        side: "sell", // The order side ('buy' or 'sell')
        type: "market", // The order type ('market', 'limit', etc.)
        time_in_force: "gtc", // Order time in force ('day', 'gtc', etc.)
      },
      url: `${ALPACA_PAPER_API_URL}/v2/orders`,
    });

    console.log("Sell order successful:", response.data);
  } catch (error: any) {
    console.error(
      `Error placing sell order: ${
        error.response ? error.response.data : error.message
      }`
    );
  }
}

async function sellAllStocks() {
  try {
    const response = await makeRequestWithRetry({
      method: "delete",
      headers: {
        "APCA-API-KEY-ID": ALPACA_API_KEY,
        "APCA-API-SECRET-KEY": ALPACA_SECRET_KEY,
      },
      url: `${ALPACA_PAPER_API_URL}/v2/positions`,
    });

    console.log("All positions closed");
  } catch (error: any) {
    console.error(
      `Error closing all positions: ${
        error.response ? error.response.data : error.message
      }`
    );
  }
}
