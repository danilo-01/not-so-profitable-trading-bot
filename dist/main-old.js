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
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const ALPACA_API_KEY = "PKONVQKGWG99GI0VFLEH";
const ALPACA_SECRET_KEY = "Qp8WAUTaHRfvqXKNw5JZiYntoUAM8qrFdHcorMy2";
const ALPACA_PAPER_API_URL = "https://paper-api.alpaca.markets";
const NEWS_API_KEY = "29983267eb3f4197a618a13026c7f8e6";
const NEWS_API_URL = "https://newsapi.org/v2/everything";
const ALPACA_NEWS_URL = "https://data.alpaca.markets/v1beta1/news";
const ALPACA_MARKET_DATA_URL = "https://data.alpaca.markets/v2";
const ALPACA_API_URL = "https://paper-api.alpaca.markets";
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5000;
const fiveMinutes = 5 * 60 * 1000;
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
        const savedJsonFileNames = getSavedJsonFileNames();
        const todaysDate = getCurrentDateFormatted();
        const initial_snapshot_location = `saved_json/initial-snapshot-${todaysDate}.json`;
        let snapshotForToday = false;
        for (const fileName of savedJsonFileNames) {
            const filesDate = parseDateFromString(fileName);
            if (filesDate === todaysDate)
                snapshotForToday = true;
        }
        //Check if there isnt already a snapshot for today
        if (!snapshotForToday) {
            console.log(`No initial snapshot for today, creating one for ${todaysDate}...`);
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
            const stockDataObject = {};
            for (const stock of response.data) {
                const stockSymbol = stock.symbol;
                if (stockSymbol &&
                    stock.tradable &&
                    stock.status === "active" &&
                    stock.exchange !== "CRYPTO" &&
                    stock.fractionable) {
                    stockDataObject[stockSymbol] = {
                        symbol: stockSymbol,
                        initialPrice: null,
                        initialTimestamp: null,
                        currentPrice: null,
                        currentTimestamp: null,
                    };
                }
            }
            // Get stock prices
            const initialStockQuotes = yield getLatestQuotes(Array.from(Object.keys(stockDataObject)));
            for (const stockQuotes of initialStockQuotes) {
                for (const stockSymbol in stockQuotes) {
                    const stockQuote = stockQuotes[stockSymbol];
                    const askingPrice = stockQuote.ap;
                    const timestamp = stockQuote.t;
                    if (askingPrice < 1 || askingPrice > 20) {
                        delete stockDataObject[stockSymbol];
                        continue;
                    }
                    const stockReference = stockDataObject[stockSymbol];
                    if (stockReference) {
                        stockReference.initialPrice = askingPrice;
                        stockReference.initialTimestamp = new Date(timestamp);
                    }
                }
            }
            // Save to instance memory
            for (const stockSymbol of Object.keys(stockDataObject)) {
                stockData.set(stockSymbol, stockDataObject[stockSymbol]);
            }
            const stockDataJSON = JSON.stringify(stockDataObject);
            // Save to saved json file
            (0, fs_1.writeFileSync)(initial_snapshot_location, stockDataJSON, "utf-8");
        }
        else {
            console.log(`Using saved json file for ${todaysDate}`);
            // Parse saved stock data
            const stockDataObject = JSON.parse((0, fs_1.readFileSync)(initial_snapshot_location, "utf-8"));
            //Apply saved stock data
            for (const stockSymbol of Object.keys(stockDataObject)) {
                stockData.set(stockSymbol, stockDataObject[stockSymbol]);
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
                if (stockSymbol === "MNY") {
                    console.log(stockQuote[stockSymbol]);
                }
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
            if (stockSymbol === "MNY") {
                console.log(stock);
            }
            try {
                const stockInitialPrice = stock.initialPrice;
                const stockCurrentPrice = stock.currentPrice;
                if (!stockInitialPrice) {
                    stockData.delete(stockSymbol);
                    throw new Error("Stocks initial prices were not set");
                }
                if (!stockCurrentPrice) {
                    stockData.delete(stockSymbol);
                    throw new Error("Stocks current prices were not set");
                }
                const percentIncrease = Math.round(((stockCurrentPrice - stockInitialPrice) / stockInitialPrice) * 100);
                // if (percentIncrease > 0) {
                //   console.log(`Percent Increase for ${stock.symbol}:`, percentIncrease);
                // }
                if (percentIncrease >= 10) {
                    if (!watchedSocks.includes(stockSymbol))
                        watchedSocks.push(stockSymbol);
                    // Check for news events
                    // const newsResponse = await getStockNewsFromPastWeek(stock.symbol);
                    // if (newsResponse.length > 0) {
                    //   console.log("fourth criteria");
                    //   filteredStocks.push(stock.symbol);
                    // }
                }
            }
            catch (error) {
                //  console.error(`Error fetching data for ${stock.symbol}:`, error.message);
            }
        }
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
            // // Get snapshot of price at the beginnning of the day (before market opens)
            // await initializeStockData();
            // // Every 15 minutes
            // setInterval(async () => {
            //   //Get all quotes for each fetched stock
            //   await setCurrentSnapshot();
            //   // Compare to see if any stocks are meeting the buy criteria
            //   await compareSnapshot();
            //   console.log(watchedSocks);
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
        }
        catch (error) {
            console.error("Error:", error);
        }
    });
}
main();
[];
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
function getCurrentDateFormatted() {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, "0"); // Get day and pad with leading zero if needed
    const month = String(today.getMonth() + 1).padStart(2, "0"); // Get month (0-indexed) and pad with leading zero
    const year = today.getFullYear(); // Get full year
    return `${day}-${month}-${year}`;
}
function parseDateFromString(str) {
    // Define a regular expression to match the date pattern
    const dateRegex = /(\d{2})-(\d{2})-(\d{4})/;
    // Use the regular expression to extract the date
    const match = str.match(dateRegex);
    if (match) {
        return match[0]; // The full date string
    }
    else {
        console.log("No date found in the string.");
        return null;
    }
}
function getSavedJsonFileNames() {
    // Define the directory path
    const directoryPath = "saved_json";
    // Read the directory contents synchronously
    try {
        const files = (0, fs_1.readdirSync)(directoryPath);
        // Filter to get only file names (excluding directories)
        const fileNames = files.filter((file) => {
            const filePath = path_1.default.join(directoryPath, file);
            return (0, fs_1.statSync)(filePath).isFile();
        });
        // Output the file names
        return fileNames;
    }
    catch (err) {
        console.log("Unable to scan directory: " + err);
        return [];
    }
}
function buyStock(tickerSymbol, quantity) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const response = yield axios_1.default.post(`${ALPACA_API_URL}/v2/orders`, {
                symbol: tickerSymbol, // The stock ticker symbol you want to buy
                qty: quantity, // The number of shares you want to buy
                side: "buy", // The order side ('buy' or 'sell')
                type: "market", // The order type ('market', 'limit', etc.)
                time_in_force: "gtc", // Order time in force ('day', 'gtc', etc.)
            }, {
                headers: {
                    "APCA-API-KEY-ID": ALPACA_API_KEY,
                    "APCA-API-SECRET-KEY": ALPACA_SECRET_KEY,
                },
            });
            console.log(`Order successful: ${response.data}`);
        }
        catch (error) {
            console.error(`Error placing order: ${error.response ? error.response.data : error.message}`);
        }
    });
}
