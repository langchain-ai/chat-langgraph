import { TripPlannerState, TripPlannerUpdate } from "../types";
import { ChatOpenAI } from "@langchain/openai";
import { typedUi } from "@langchain/langgraph-sdk/react-ui/server";
import type ComponentMap from "../../uis/index";
import { z } from "zod";
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { getAccommodationsListProps } from "../utils/get-accommodations";
import { findToolCall } from "../../find-tool-call";

const listAccommodationsSchema = z.object({}).describe("A tool to list accommodations for the user")
const bookAccommodationSchema = z.object({
  accommodationName: z.string().describe("The name of the accommodation to book a reservation for"),
}).describe("A tool to book a reservation for an accommodation");
const listRestaurantsSchema = z.object({}).describe("A tool to list restaurants for the user");
const bookRestaurantSchema = z.object({
  restaurantName: z.string().describe("The name of the restaurant to book a reservation for"),
}).describe("A tool to book a reservation for a restaurant");

const ACCOMMODATIONS_TOOLS = [
  {
    name: "list-accommodations",
    description: "A tool to list accommodations for the user",
    schema: listAccommodationsSchema,
  },
  {
    name: "book-accommodation",
    description: "A tool to book a reservation for an accommodation",
    schema: bookAccommodationSchema,
  },
  {
    name: "list-restaurants",
    description: "A tool to list restaurants for the user",
    schema: listRestaurantsSchema,
  },
  {
    name: "book-restaurant",
    description: "A tool to book a reservation for a restaurant",
    schema: bookRestaurantSchema,
  },
];

export async function callTools(
  state: TripPlannerState,
  config: LangGraphRunnableConfig,
): Promise<TripPlannerUpdate> {
  if (!state.tripDetails) {
    throw new Error("No trip details found");
  }

  const ui = typedUi<typeof ComponentMap>(config);

  const llm = new ChatOpenAI({ model: "gpt-4o", temperature: 0 }).bindTools(ACCOMMODATIONS_TOOLS);

  const response = await llm.invoke([
    {
      role: "system",
      content:
        "You are an AI assistant who helps users book trips. Use the user's most recent message(s) to contextually generate a response.",
    },
    ...state.messages,
  ]);

  const listAccommodationsToolCall = response.tool_calls?.find(
    findToolCall("list-accommodations")<typeof listAccommodationsSchema>,
  );
  const bookAccommodationToolCall = response.tool_calls?.find(
    findToolCall("book-accommodation")<typeof bookAccommodationSchema>,
  );
  const listRestaurantsToolCall = response.tool_calls?.find(
    findToolCall("list-restaurants")<typeof listRestaurantsSchema>,
  );
  const bookRestaurantToolCall = response.tool_calls?.find(
    findToolCall("book-restaurant")<typeof bookRestaurantSchema>,
  );

  if (!listAccommodationsToolCall && !bookAccommodationToolCall && !listRestaurantsToolCall && !bookRestaurantToolCall) {
    throw new Error("No tool calls found");
  }

  if (listAccommodationsToolCall) {
    ui.write("accommodations-list", {
      toolCallId: listAccommodationsToolCall.id ?? "",
      ...getAccommodationsListProps(state.tripDetails),
    });
  }
  if (bookAccommodationToolCall && bookAccommodationToolCall.args.accommodationName) {
    ui.write("book-accommodation", {
      tripDetails: state.tripDetails,
      accommodationName: bookAccommodationToolCall.args.accommodationName,
    });
  }

  if (listRestaurantsToolCall) {
    ui.write("restaurants-list", { tripDetails: state.tripDetails });
  }

  if (bookRestaurantToolCall && bookRestaurantToolCall.args.restaurantName) {
    ui.write("book-restaurant", {
      tripDetails: state.tripDetails,
      restaurantName: bookRestaurantToolCall.args.restaurantName,
    });
  }

  return {
    messages: [response],
    ui: ui.collect as TripPlannerUpdate["ui"],
    timestamp: Date.now(),
  };
}
