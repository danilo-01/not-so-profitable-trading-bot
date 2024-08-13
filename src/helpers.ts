import axios, { AxiosRequestConfig } from "axios";

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5000;

export async function makeRequestWithRetry(
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
