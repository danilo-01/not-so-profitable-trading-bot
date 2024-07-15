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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
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
const watchedSocks = [];
const stockData = new Map();
function makeRequestWithRetry(config_1) {
    return __awaiter(this, arguments, void 0, function* (config, retries = MAX_RETRIES) {
        try {
            return yield (0, axios_1.default)(config);
        }
        catch (error) {
            if (error.response && error.response.status === 429 && retries > 0) {
                console.log(`Rate limit exceeded. Retrying in ${RETRY_DELAY_MS}ms...`);
                yield new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
                return makeRequestWithRetry(config, retries - 1);
            }
            else {
                throw error;
            }
        }
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
        const response = yield axios_1.default.post(`${ALPACA_PAPER_API_URL}/v2/orders`, order, {
            headers: {
                "APCA-API-KEY-ID": ALPACA_API_KEY,
                "APCA-API-SECRET-KEY": ALPACA_SECRET_KEY,
            },
        });
        return response.data;
    });
}
function initializeStockData() {
    return __awaiter(this, void 0, void 0, function* () {
        // Fetch all available stocks
        const config = {
            method: "get",
            url: `${ALPACA_PAPER_API_URL}/v2/assets`,
            headers: {
                "APCA-API-KEY-ID": ALPACA_API_KEY,
                "APCA-API-SECRET-KEY": ALPACA_SECRET_KEY,
            },
        };
        const response = yield makeRequestWithRetry(config);
        console.log(response.data.length);
        let cnt = 0;
        for (const stock of response.data) {
            const stockSymbol = stock.symbol;
            if (stockSymbol &&
                stock.tradable &&
                stock.status !== "inactive" &&
                stock.exchange !== "CRYPTO" &&
                stock.fractionable) {
                cnt++;
                stockData.set(stockSymbol, {
                    symbol: stockSymbol,
                    initialPrice: null,
                    initialTimestamp: null,
                    currentPrice: null,
                    currentTimestamp: null,
                });
            }
        }
        console.log("after filtering: ", cnt);
        return;
    });
}
function setInitialSnapshot() {
    return __awaiter(this, void 0, void 0, function* () {
        const initialStockQuotes = yield getLatestQuotes(Array.from(stockData.keys()));
        for (const stockQuotes of initialStockQuotes) {
            for (const stockSymbol in stockQuotes) {
                const stockQuote = stockQuotes[stockSymbol];
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
    });
}
function setCurrentSnapshot() {
    return __awaiter(this, void 0, void 0, function* () {
        const initialStockQuotes = yield getLatestQuotes(Array.from(stockData.keys()));
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
    });
}
function compareSnapshot() {
    return __awaiter(this, void 0, void 0, function* () {
        for (const stockSymbol of Array.from(stockData.keys())) {
            const stock = stockData.get(stockSymbol);
            try {
                const stockInitialPrice = stock.initialPrice;
                const stockCurrentPrice = stock.currentPrice;
                if (!stockInitialPrice || !stockCurrentPrice) {
                    stockData.delete(stockSymbol);
                    throw new Error("Stocks initial or current prices were not set");
                }
                const percentIncrease = ((stockCurrentPrice - stockInitialPrice) / stockInitialPrice) * 100;
                console.log(`Percent Increase for ${stock.symbol}:`, percentIncrease);
                if (percentIncrease >= 10) {
                    // Check for news events
                    // const newsResponse = await getStockNewsFromPastWeek(stock.symbol);
                    // if (newsResponse.length > 0) {
                    //   console.log("fourth criteria");
                    //   filteredStocks.push(stock.symbol);
                    // }
                }
            }
            catch (error) {
                console.error(`Error fetching data for ${stock.symbol}:`, error.message);
            }
        }
        console.log(stockData.size);
    });
}
function checkImportantStocks() {
    return __awaiter(this, void 0, void 0, function* () {
        return;
    });
}
// Main function to get the filtered stocks and place trades
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Get all active and tradable stocks
            yield initializeStockData();
            // Get snapshot of price at the beginnning of the day (before market opens)
            yield setInitialSnapshot();
            // Every 15 minutes
            setInterval(() => __awaiter(this, void 0, void 0, function* () {
                //Get all quotes for each fetched stock
                yield setCurrentSnapshot();
                // Compare to see if any stocks are meeting the buy criteria
                yield compareSnapshot();
            }), 20000);
            // Every 15 minutes, check important stocks
            setInterval(() => __awaiter(this, void 0, void 0, function* () { return yield checkImportantStocks(); }), fifteenMinutes);
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
        }
        catch (error) {
            console.error("Error:", error);
        }
    });
}
main();
function getLatestQuotes(symbolsArray) {
    return __awaiter(this, void 0, void 0, function* () {
        const symbolsChunks = chunkArray(symbolsArray, 10000);
        const responses = [];
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
            const response = yield makeRequestWithRetry(config);
            responses.push(response.data.quotes);
        }
        return responses;
    });
}
function getStockNewsFromPastWeek(symbol) {
    return __awaiter(this, void 0, void 0, function* () {
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
            const response = yield axios_1.default.get(ALPACA_NEWS_URL, {
                params,
                headers,
            });
            return response.data.news;
        }
        catch (error) {
            console.error("Error fetching news:", error);
            return [];
        }
    });
}
function chunkArray(array, chunkSize) {
    const result = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        result.push(array.slice(i, i + chunkSize));
    }
    return result;
}
