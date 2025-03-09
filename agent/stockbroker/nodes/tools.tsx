import { StockbrokerState, StockbrokerUpdate } from "../types";
import { ChatOpenAI } from "@langchain/openai";
import { typedUi } from "@langchain/langgraph-sdk/react-ui/server";
import type ComponentMap from "../../uis/index";
import { z } from "zod";
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { findToolCall } from "../../find-tool-call";
import { format, subDays } from "date-fns";
import { Price, Snapshot } from "../../types";

async function getNextPageData(url: string) {
  if (!process.env.FINANCIAL_DATASETS_API_KEY) {
    throw new Error("Financial datasets API key not set");
  }

  const options = {
    method: "GET",
    headers: { "X-API-KEY": process.env.FINANCIAL_DATASETS_API_KEY },
  };

  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error("Failed to fetch prices");
  }
  return await response.json();
}

async function getPricesForTicker(ticker: string): Promise<{
  oneDayPrices: Price[];
  thirtyDayPrices: Price[];
}> {
  if (!process.env.FINANCIAL_DATASETS_API_KEY) {
    throw new Error("Financial datasets API key not set");
  }

  const options = {
    method: "GET",
    headers: { "X-API-KEY": process.env.FINANCIAL_DATASETS_API_KEY },
  };

  const url = "https://api.financialdatasets.ai/prices";

  const oneMonthAgo = format(subDays(new Date(), 30), "yyyy-MM-dd");
  const now = format(new Date(), "yyyy-MM-dd");

  const queryParamsOneDay = new URLSearchParams({
    ticker,
    interval: "minute",
    interval_multiplier: "5",
    start_date: now,
    end_date: now,
    limit: "5000",
  });

  const queryParamsThirtyDays = new URLSearchParams({
    ticker,
    interval: "minute",
    interval_multiplier: "30",
    start_date: oneMonthAgo,
    end_date: now,
    limit: "5000",
  });

  const [resOneDay, resThirtyDays] = await Promise.all([
    fetch(`${url}?${queryParamsOneDay.toString()}`, options),
    fetch(`${url}?${queryParamsThirtyDays.toString()}`, options),
  ]);

  if (!resOneDay.ok || !resThirtyDays.ok) {
    throw new Error("Failed to fetch prices");
  }

  const { prices: pricesOneDay } = await resOneDay.json();
  const { prices: pricesThirtyDays, next_page_url } =
    await resThirtyDays.json();

  let nextPageUrlThirtyDays = next_page_url;

  let iters = 0;
  while (nextPageUrlThirtyDays) {
    if (iters > 10) {
      throw new Error("MAX ITERS REACHED");
    }
    const nextPageData = await getNextPageData(nextPageUrlThirtyDays);
    pricesThirtyDays.push(...nextPageData.prices);
    nextPageUrlThirtyDays = nextPageData.next_page_url;
    iters += 1;
  }

  return {
    oneDayPrices: pricesOneDay,
    thirtyDayPrices: pricesThirtyDays,
  };
}

async function getPriceSnapshotForTicker(ticker: string): Promise<Snapshot> {
  if (!process.env.FINANCIAL_DATASETS_API_KEY) {
    throw new Error("Financial datasets API key not set");
  }

  const options = {
    method: "GET",
    headers: { "X-API-KEY": process.env.FINANCIAL_DATASETS_API_KEY },
  };
  const url = "https://api.financialdatasets.ai/prices/snapshot";

  const queryParams = new URLSearchParams({
    ticker,
  });

  const response = await fetch(`${url}?${queryParams.toString()}`, options);
  if (!response.ok) {
    throw new Error("Failed to fetch price snapshot");
  }

  const { snapshot } = await response.json();
  return snapshot;
}

const llm = new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0 });

const getStockPriceSchema = z.object({
  ticker: z.string().describe("The ticker symbol of the company"),
});
const getPortfolioSchema = z.object({
  get_portfolio: z.boolean().describe("Should be true."),
});
const buyStockSchema = z.object({
  ticker: z.string().describe("The ticker symbol of the company"),
  quantity: z.number().describe("The quantity of the stock to buy"),
});

const STOCKBROKER_TOOLS = [
  {
    name: "stock-price",
    description: "A tool to get the stock price of a company",
    schema: getStockPriceSchema,
  },
  {
    name: "portfolio",
    description:
      "A tool to get the user's portfolio details. Only call this tool if the user requests their portfolio details.",
    schema: getPortfolioSchema,
  },
  {
    name: "buy-stock",
    description: "A tool to buy a stock",
    schema: buyStockSchema,
  },
];

export async function callTools(
  state: StockbrokerState,
  config: LangGraphRunnableConfig,
): Promise<StockbrokerUpdate> {
  const ui = typedUi<typeof ComponentMap>(config);

  const message = await llm.bindTools(STOCKBROKER_TOOLS).invoke([
    {
      role: "system",
      content:
        "You are a stockbroker agent that uses tools to get the stock price of a company",
    },
    ...state.messages,
  ]);

  const stockbrokerToolCall = message.tool_calls?.find(
    findToolCall("stock-price")<typeof getStockPriceSchema>,
  );
  const portfolioToolCall = message.tool_calls?.find(
    findToolCall("portfolio")<typeof getPortfolioSchema>,
  );
  const buyStockToolCall = message.tool_calls?.find(
    findToolCall("buy-stock")<typeof buyStockSchema>,
  );

  if (stockbrokerToolCall) {
    const prices = await getPricesForTicker(stockbrokerToolCall.args.ticker);
    ui.write("stock-price", {
      ticker: stockbrokerToolCall.args.ticker,
      ...prices,
    });
  }
  if (portfolioToolCall) {
    ui.write("portfolio", {});
  }
  if (buyStockToolCall) {
    const snapshot = await getPriceSnapshotForTicker(
      buyStockToolCall.args.ticker,
    );
    ui.write("buy-stock", {
      toolCallId: buyStockToolCall.id ?? "",
      snapshot,
      quantity: buyStockToolCall.args.quantity,
    });
  }

  return {
    messages: [message],
    ui: ui.collect as StockbrokerUpdate["ui"],
    timestamp: Date.now(),
  };
}
