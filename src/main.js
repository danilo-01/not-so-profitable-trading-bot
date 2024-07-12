"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const axios = require("axios");
const ALPACA_API_KEY = "PKONVQKGWG99GI0VFLEH";
const ALPACA_SECRET_KEY = "Qp8WAUTaHRfvqXKNw5JZiYntoUAM8qrFdHcorMy2";
const ALPACA_PAPER_API_URL = "https://paper-api.alpaca.markets";
const NEWS_API_KEY = "29983267eb3f4197a618a13026c7f8e6";
const NEWS_API_URL = "https://newsapi.org/v2/everything";
const ALPACA_MARKET_DATA_URL = "https://data.alpaca.markets/v2";
// Function to get all active stocks
function getActiveStocks() {
    return __awaiter(this, void 0, void 0, function* () {
        const response = yield axios.get(`${ALPACA_PAPER_API_URL}/v2/assets`, {
            headers: {
                "APCA-API-KEY-ID": ALPACA_API_KEY,
                "APCA-API-SECRET-KEY": ALPACA_SECRET_KEY,
            },
        });
        return response.data;
    });
}
// Function to get stock quotes
function getStockQuote(symbol) {
    return __awaiter(this, void 0, void 0, function* () {
        const response = yield axios.get(`${ALPACA_MARKET_DATA_URL}/stocks/${symbol}/quotes/latest`, {
            headers: {
                "APCA-API-KEY-ID": ALPACA_API_KEY,
                "APCA-API-SECRET-KEY": ALPACA_SECRET_KEY,
            },
        });
        return response.data;
    });
}
// Function to fetch historical bars data
function getHistoricalBars(symbol, timeframe, limit) {
    return __awaiter(this, void 0, void 0, function* () {
        const response = yield axios.get(`${ALPACA_MARKET_DATA_URL}/stocks/${symbol}/bars`, {
            params: {
                timeframe: timeframe,
                limit: limit,
            },
            headers: {
                "APCA-API-KEY-ID": ALPACA_API_KEY,
                "APCA-API-SECRET-KEY": ALPACA_SECRET_KEY,
            },
        });
        console.log(response.data);
        return response.data.bars;
    });
}
// Function to filter stocks by price and volume
function filterStocks(stocks) {
    return __awaiter(this, void 0, void 0, function* () {
        const filteredStocks = [];
        for (const stock of stocks) {
            if (stock.symbol !== "DHAI")
                continue;
            if (stock.status === "active" && stock.tradable) {
                try {
                    const quote = yield getStockQuote(stock.symbol);
                    console.log("stock ", stock);
                    console.log(quote);
                    if (quote.quote.ap >= 1 && quote.quote.ap <= 20) {
                        // Fetch historical bars for the past week (5 trading days)
                        const weekBars = yield getHistoricalBars(stock.symbol, "1Day", 5);
                        // Calculate combined price of the past week
                        let weekCombinedPrice = 0;
                        for (const bar of weekBars) {
                            weekCombinedPrice += bar.c;
                        }
                        // Calculate if the current price is 10% higher than combined past week
                        const currentPrice = quote.quote.ap;
                        const percentIncrease = (currentPrice - weekCombinedPrice) / weekCombinedPrice;
                        console.log(`Percent Increase for ${stock.symbol}:`, percentIncrease);
                        if (percentIncrease >= 0.1 && stock.fractionable) {
                            // Check for news events
                            const newsResponse = yield axios.get(NEWS_API_URL, {
                                params: {
                                    q: stock.symbol,
                                    apiKey: NEWS_API_KEY,
                                },
                            });
                            if (newsResponse.data.articles.length > 0) {
                                console.log("fourth criteria");
                                filteredStocks.push(stock.symbol);
                            }
                        }
                    }
                }
                catch (error) {
                    console.error(`Error fetching data for ${stock.symbol}:`, error.message);
                }
            }
        }
        return filteredStocks;
    });
}
// Function to place a paper trade
function placePaperTrade(symbol, qty, side) {
    return __awaiter(this, void 0, void 0, function* () {
        const order = {
            symbol: symbol,
            qty: qty,
            side: side,
            type: "market",
            time_in_force: "gtc",
        };
        const response = yield axios.post(`${ALPACA_PAPER_API_URL}/v2/orders`, order, {
            headers: {
                "APCA-API-KEY-ID": ALPACA_API_KEY,
                "APCA-API-SECRET-KEY": ALPACA_SECRET_KEY,
            },
        });
        return response.data;
    });
}
// Main function to get the filtered stocks and place trades
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const stocks = yield getActiveStocks();
            const filteredStocks = yield filterStocks(stocks);
            console.log("Filtered Stocks:", filteredStocks);
            // Example: Place a buy order for each filtered stock
            // for (const symbol of filteredStocks) {
            //   const tradeResponse = await placePaperTrade(symbol, 1, "buy");
            //   console.log("Trade Response:", tradeResponse);
            // }
        }
        catch (error) {
            console.error("Error:", error);
        }
    });
}
main();
