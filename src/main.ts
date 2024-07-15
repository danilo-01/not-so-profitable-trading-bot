import axios, { AxiosRequestConfig } from "axios";
import { AlpacaStockData, AlpacaStockQuote, StockData } from "./types";

const ALPACA_API_KEY = "PKONVQKGWG99GI0VFLEH";
const ALPACA_SECRET_KEY = "Qp8WAUTaHRfvqXKNw5JZiYntoUAM8qrFdHcorMy2";
const ALPACA_PAPER_API_URL = "https://paper-api.alpaca.markets";
const NEWS_API_KEY = "29983267eb3f4197a618a13026c7f8e6";
const NEWS_API_URL = "https://newsapi.org/v2/everything";
const ALPACA_NEWS_URL = "https://data.alpaca.markets/v1beta1/news";
const ALPACA_MARKET_DATA_URL = "https://data.alpaca.markets/v2";

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5000;

const fifteenMinutes = 15 * 60 * 1000;

const watchedSocks: string[] = [];

const stockData: Map<string, StockData> = new Map();

async function makeRequestWithRetry(
  config: AxiosRequestConfig,
  retries = MAX_RETRIES
) {
  try {
    return await axios(config);
  } catch (error: any) {
    if (error.response && error.response.status === 429 && retries > 0) {
      console.log(`Rate limit exceeded. Retrying in ${RETRY_DELAY_MS}ms...`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      return makeRequestWithRetry(config, retries - 1);
    } else {
      throw error;
    }
  }
}

// Function to place a paper trade
async function placePaperTrade(symbol: string, qty: number, side: string) {
  const order = {
    symbol: symbol,
    qty: qty,
    side: side,
    type: "market",
    time_in_force: "gtc",
  };

  const response = await axios.post(
    `${ALPACA_PAPER_API_URL}/v2/orders`,
    order,
    {
      headers: {
        "APCA-API-KEY-ID": ALPACA_API_KEY,
        "APCA-API-SECRET-KEY": ALPACA_SECRET_KEY,
      },
    }
  );
  return response.data;
}

async function initializeStockData() {
  // Fetch all available stocks
  const config = {
    method: "get",
    url: `${ALPACA_PAPER_API_URL}/v2/assets`,
    headers: {
      "APCA-API-KEY-ID": ALPACA_API_KEY,
      "APCA-API-SECRET-KEY": ALPACA_SECRET_KEY,
    },
  };
  const response = await makeRequestWithRetry(config);

  for (const stock of response.data as AlpacaStockData[]) {
    const stockSymbol: string = stock.symbol;

    if (
      stockSymbol &&
      stock.tradable &&
      stock.status === "active" &&
      stock.exchange !== "CRYPTO" &&
      stock.fractionable
    ) {
      stockData.set(stockSymbol, {
        symbol: stockSymbol,
        initialPrice: null,
        initialTimestamp: null,
        currentPrice: null,
        currentTimestamp: null,
      });
    }
  }

  return;
}

async function setInitialSnapshot() {
  const initialStockQuotes = await getLatestQuotes(
    Array.from(stockData.keys())
  );

  for (const stockQuotes of initialStockQuotes) {
    for (const stockSymbol in stockQuotes) {
      const stockQuote = stockQuotes[stockSymbol];
      console.log(stockQuote);
      const askingPrice = stockQuote.ap;
      const timestamp = stockQuote.t;

      if (askingPrice < 1 || askingPrice > 20) {
        stockData.delete(stockSymbol);
        continue;
      }

      const stockReference = stockData.get(stockSymbol);

      if (stockReference) {
        stockReference.initialPrice = askingPrice;
        stockReference.initialTimestamp = new Date(timestamp);
      }
    }
  }

  return;
}

async function setCurrentSnapshot() {
  const initialStockQuotes = await getLatestQuotes(
    Array.from(stockData.keys())
  );

  for (const stockQuote of initialStockQuotes) {
    for (const stockSymbol in stockQuote) {
      const askingPrice = stockQuote[stockSymbol].ap;
      const timestamp = stockQuote[stockSymbol].t;

      const stockReference = stockData.get(stockSymbol);

      if (stockReference) {
        stockReference.currentPrice = askingPrice;
        stockReference.currentTimestamp = new Date(timestamp);
      }
    }
  }
  return;
}

async function compareSnapshot() {
  for (const stockSymbol of Array.from(stockData.keys())) {
    const stock = stockData.get(stockSymbol)!;

    try {
      const stockInitialPrice = stock.initialPrice;
      const stockCurrentPrice = stock.currentPrice;

      if (!stockInitialPrice || !stockCurrentPrice) {
        stockData.delete(stockSymbol);
        throw new Error("Stocks initial or current prices were not set");
      }

      const percentIncrease =
        ((stockCurrentPrice - stockInitialPrice) / stockInitialPrice) * 100;

      console.log(`Percent Increase for ${stock.symbol}:`, percentIncrease);

      if (percentIncrease >= 10) {
        // Check for news events
        // const newsResponse = await getStockNewsFromPastWeek(stock.symbol);
        // if (newsResponse.length > 0) {
        //   console.log("fourth criteria");
        //   filteredStocks.push(stock.symbol);
        // }
      }
    } catch (error: any) {
      console.error(`Error fetching data for ${stock.symbol}:`, error.message);
    }
  }

  console.log(stockData.size);
}

async function checkImportantStocks() {
  return;
}

// Main function to get the filtered stocks and place trades
async function main() {
  try {
    // Get all active and tradable stocks
    await initializeStockData();

    // Get snapshot of price at the beginnning of the day (before market opens)
    await setInitialSnapshot();

    // // Every 15 minutes
    // setInterval(async () => {
    //   //Get all quotes for each fetched stock
    //   await setCurrentSnapshot();

    //   // Compare to see if any stocks are meeting the buy criteria
    //   await compareSnapshot();
    // }, 20000);

    // // Every 15 minutes, check important stocks
    // setInterval(async () => await checkImportantStocks(), fifteenMinutes);

    // Check which stocks are moving up and meeting the buy criteria

    // When a stock meets the criteria buy it and move it to an importnt watch list which fetches the quote of those stocks more frequently

    // When watched stocks lose a certain amount  or gain a certain amouint sell them

    // const latestQuotes = await getLatestQuotes(symbols);
    // console.log(latestQuotes);

    // console.log(symbols.length);
    // const filteredStocks = await filterStocks(stocks);
    // console.log("Filtered Stocks:", filteredStocks);

    // const newsArticles = await getStockNewsFromPastWeek("DHAI");
    // console.log(newsArticles);
    // Example: Place a buy order for each filtered stock
    // for (const symbol of filteredStocks) {
    //   const tradeResponse = await placePaperTrade(symbol, 1, "buy");
    //   console.log("Trade Response:", tradeResponse);
    // }
  } catch (error) {
    console.error("Error:", error);
  }
}

main();

async function getLatestQuotes(symbolsArray: string[]) {
  const symbolsChunks = chunkArray(symbolsArray, 10000);
  const responses: {
    [stockSymbol: string]: AlpacaStockQuote;
  }[] = [];

  for (const chunk of symbolsChunks) {
    const symbols = chunk.join(",");

    const config = {
      method: "get",
      url: `https://data.alpaca.markets/v2/stocks/quotes/latest`,
      headers: {
        "APCA-API-KEY-ID": ALPACA_API_KEY,
        "APCA-API-SECRET-KEY": ALPACA_SECRET_KEY,
      },
      params: {
        symbols: symbols,
      },
    };

    const response = await makeRequestWithRetry(config);

    responses.push(response.data.quotes);
  }

  return responses;
}

interface NewsArticle {
  id: string;
  headline: string;
  summary: string;
  content: string;
  symbols: string[];
  source: string;
  author: string;
  created_at: string;
  updated_at: string;
  url: string;
  images: Array<{ size: string; url: string }>;
}

async function getStockNewsFromPastWeek(
  symbol: string
): Promise<NewsArticle[]> {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const startDate = oneWeekAgo.toISOString().split("T")[0]; // Get date in YYYY-MM-DD format
  const endDate = new Date().toISOString().split("T")[0]; // Get today's date in YYYY-MM-DD format

  const params = {
    symbols: symbol,
    start: startDate,
    end: endDate,
    limit: 10, // Adjust as needed
  };

  const headers = {
    "APCA-API-KEY-ID": ALPACA_API_KEY,
    "APCA-API-SECRET-KEY": ALPACA_SECRET_KEY,
  };

  try {
    const response = await axios.get(ALPACA_NEWS_URL, {
      params,
      headers,
    });
    return response.data.news;
  } catch (error) {
    console.error("Error fetching news:", error);
    return [];
  }
}

function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const result: T[][] = [];

  for (let i = 0; i < array.length; i += chunkSize) {
    result.push(array.slice(i, i + chunkSize));
  }
  return result;
}
