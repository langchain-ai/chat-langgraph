import { v4 as uuidv4 } from "uuid";
import { ChatOpenAI } from "@langchain/openai";
import { TripDetails, TripPlannerState, TripPlannerUpdate } from "../types";
import { z } from "zod";
import { formatMessages } from "agent/utils/format-messages";
import { ToolMessage } from "@langchain/langgraph-sdk";
import { DO_NOT_RENDER_ID_PREFIX } from "@/lib/ensure-tool-responses";

function calculateDates(
  startDate: string | undefined,
  endDate: string | undefined,
): { startDate: Date; endDate: Date } {
  const now = new Date();

  if (!startDate && !endDate) {
    // Both undefined: 4 and 5 weeks in future
    const start = new Date(now);
    start.setDate(start.getDate() + 28); // 4 weeks
    const end = new Date(now);
    end.setDate(end.getDate() + 35); // 5 weeks
    return { startDate: start, endDate: end };
  }

  if (startDate && !endDate) {
    // Only start defined: end is 1 week after
    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { startDate: start, endDate: end };
  }

  if (!startDate && endDate) {
    // Only end defined: start is 1 week before
    const end = new Date(endDate);
    const start = new Date(end);
    start.setDate(start.getDate() - 7);
    return { startDate: start, endDate: end };
  }

  // Both defined: use as is
  return {
    startDate: new Date(startDate!),
    endDate: new Date(endDate!),
  };
}

export async function extraction(
  state: TripPlannerState,
): Promise<TripPlannerUpdate> {
  const schema = z.object({
    location: z
      .string()
      .describe(
        "The location to plan the trip for. Can be a city, state, or country.",
      ),
    startDate: z
      .string()
      .optional()
      .describe("The start date of the trip. Should be in YYYY-MM-DD format"),
    endDate: z
      .string()
      .optional()
      .describe("The end date of the trip. Should be in YYYY-MM-DD format"),
    numberOfGuests: z
      .number()
      .describe("The number of guests for the trip. Should default to 2 if not specified"),
  });

  const model = new ChatOpenAI({ model: "gpt-4o", temperature: 0 }).bindTools([
    {
      name: "extract",
      description: "A tool to extract information from a user's request.",
      schema: schema,
    },
  ]);

  const prompt = `You're an AI assistant for planning trips. The user has requested information about a trip they want to go on.
Before you can help them, you need to extract the following information from their request:
- location - The location to plan the trip for. Can be a city, state, or country.
- startDate - The start date of the trip. Should be in YYYY-MM-DD format. Optional
- endDate - The end date of the trip. Should be in YYYY-MM-DD format. Optional
- numberOfGuests - The number of guests for the trip. Optional

You are provided with the ENTIRE conversation history between you, and the user. Use these messages to extract the necessary information.

Do NOT guess, or make up any information. If the user did NOT specify a location, please respond with a request for them to specify the location.
You should ONLY send a clarification message if the user did not provide the location. You do NOT need any of the other fields, so if they're missing, proceed without them.
It should be a single sentence, along the lines of "Please specify the location for the trip you want to go on".

Extract only what is specified by the user. It is okay to leave fields blank if the user did not specify them.
`;

  const humanMessage = `Here is the entire conversation so far:\n${formatMessages(state.messages)}`;

  const response = await model.invoke([
    { role: "system", content: prompt },
    { role: "human", content: humanMessage },
  ]);

  const toolCall = response.tool_calls?.[0];
  if (!toolCall) {
    return {
      messages: [response],
    };
  }
  const extractedDetails = toolCall.args as z.infer<typeof schema>;

  const { startDate, endDate } = calculateDates(
    extractedDetails.startDate,
    extractedDetails.endDate,
  );

  const extractionDetailsWithDefaults: TripDetails = {
    startDate,
    endDate,
    numberOfGuests: extractedDetails.numberOfGuests ?? 2,
    location: extractedDetails.location,
  };

  const extractToolResponse: ToolMessage = {
    type: "tool",
    id: `${DO_NOT_RENDER_ID_PREFIX}${uuidv4()}`,
    tool_call_id: toolCall.id ?? "",
    content: "Successfully extracted trip details",
  };

  return {
    tripDetails: extractionDetailsWithDefaults,
    messages: [response, extractToolResponse]
  };
}
