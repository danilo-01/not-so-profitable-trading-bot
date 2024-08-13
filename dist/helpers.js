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
exports.makeRequestWithRetry = makeRequestWithRetry;
const axios_1 = __importDefault(require("axios"));
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5000;
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
