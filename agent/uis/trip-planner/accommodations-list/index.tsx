import "./index.css";
import { v4 as uuidv4 } from "uuid";
import {
  useStreamContext,
  type UIMessage,
} from "@langchain/langgraph-sdk/react-ui";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TripDetails } from "../../../trip-planner/types";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { format } from "date-fns";
import { Accommodation } from "agent/types";
import { capitalizeSentence } from "../../../utils/capitalize";
import { Message } from "@langchain/langgraph-sdk";
import { getToolResponse } from "../../utils/get-tool-response";
import { DO_NOT_RENDER_ID_PREFIX } from "@/lib/ensure-tool-responses";

const StarSVG = ({ fill = "white" }: { fill?: string }) => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 10 10"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M4.73158 0.80127L6.26121 3.40923L9.23158 4.04798L7.20658 6.29854L7.51273 9.30127L4.73158 8.08423L1.95043 9.30127L2.25658 6.29854L0.23158 4.04798L3.20195 3.40923L4.73158 0.80127Z"
      fill={fill}
    />
  </svg>
);

function AccommodationCard({
  accommodation,
}: {
  accommodation: Accommodation;
}) {
  return (
    <div
      className="relative w-[161px] h-[256px] rounded-2xl shadow-md overflow-hidden"
      style={{
        backgroundImage: `url(${accommodation.image})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="absolute bottom-0 left-0 right-0 flex flex-col gap-1 p-3 text-white bg-gradient-to-t from-black/70 to-transparent">
        <p className="text-sm font-semibold">{accommodation.name}</p>
        <div className="flex items-center gap-1 text-xs">
          <p className="flex items-center justify-center">
            <StarSVG />
            {accommodation.rating}
          </p>
          <p>·</p>
          <p>{accommodation.price}</p>
        </div>
        <p className="text-sm">{capitalizeSentence(accommodation.city)}</p>
      </div>
    </div>
  );
}

function SelectedAccommodation({
  accommodation,
  onHide,
  tripDetails,
  onBook,
}: {
  accommodation: Accommodation;
  onHide: () => void;
  tripDetails: TripDetails;
  onBook: (accommodation: Accommodation) => void;
}) {
  const startDate = new Date(tripDetails.startDate);
  const endDate = new Date(tripDetails.endDate);
  const totalTripDurationDays = Math.max(
    startDate.getDate() - endDate.getDate(),
    1,
  );
  const totalPrice = totalTripDurationDays * accommodation.price;

  return (
    <div className="w-full flex gap-6 rounded-2xl overflow-hidden bg-white shadow-lg">
      <div className="w-2/3 h-[400px]">
        <img
          src={accommodation.image}
          alt={accommodation.name}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="w-1/3 p-4 flex flex-col">
        <div className="flex justify-between items-center mb-4 gap-3">
          <h3 className="text-xl font-semibold">{accommodation.name}</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onHide}
            className="cursor-pointer hover:bg-gray-50 transition-colors ease-in-out duration-200 text-gray-500 w-5 h-5"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
        <div className="flex-1 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1">
              <StarSVG fill="black" />
              {accommodation.rating}
            </span>
            <p className="text-gray-600">
              {capitalizeSentence(accommodation.city)}
            </p>
          </div>
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex justify-between">
              <span>Check-in</span>
              <span>{format(startDate, "MMM d, yyyy")}</span>
            </div>
            <div className="flex justify-between">
              <span>Check-out</span>
              <span>{format(endDate, "MMM d, yyyy")}</span>
            </div>
            <div className="flex justify-between">
              <span>Guests</span>
              <span>{tripDetails.numberOfGuests}</span>
            </div>
            <div className="flex justify-between font-semibold text-black">
              <span>Total Price</span>
              <span>${totalPrice.toLocaleString()}</span>
            </div>
          </div>
        </div>
        <Button
          onClick={() => onBook(accommodation)}
          variant="secondary"
          className="w-full bg-gray-800 text-white hover:bg-gray-900 cursor-pointer transition-colors ease-in-out duration-200"
        >
          Book
        </Button>
      </div>
    </div>
  );
}

function BookedAccommodation({
  accommodation,
  tripDetails,
}: {
  accommodation: Accommodation;
  tripDetails: TripDetails;
}) {
  const startDate = new Date(tripDetails.startDate);
  const endDate = new Date(tripDetails.endDate);
  const totalTripDurationDays = Math.max(
    startDate.getDate() - endDate.getDate(),
    1,
  );
  const totalPrice = totalTripDurationDays * accommodation.price;

  return (
    <div
      className="relative w-full h-[400px] rounded-2xl shadow-md overflow-hidden"
      style={{
        backgroundImage: `url(${accommodation.image})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="absolute bottom-0 left-0 right-0 flex flex-col gap-2 p-6 text-white bg-gradient-to-t from-black/90 via-black/70 to-transparent">
        <p className="text-lg font-medium">Booked Accommodation</p>

        <div className="flex justify-between items-baseline">
          <h3 className="text-xl font-semibold"></h3>
        </div>
        <div className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm">
          <div className="flex justify-between">
            <span>Address:</span>
          </div>
          <div className="flex justify-between">
            <span>
              {accommodation.name}, {capitalizeSentence(accommodation.city)}
            </span>
          </div>

          <div className="flex justify-between">
            <span>Rating:</span>
          </div>
          <div className="flex justify-between">
            <span className="flex items-center gap-1">
              <StarSVG />
              {accommodation.rating}
            </span>
          </div>

          <div className="flex justify-between">
            <span>Dates:</span>
          </div>
          <div className="flex justify-between">
            <span>
              {format(startDate, "MMM d, yyyy")} -{" "}
              {format(endDate, "MMM d, yyyy")}
            </span>
          </div>

          <div className="flex justify-between">
            <span>Guests:</span>
          </div>
          <div className="flex justify-between">
            <span>{tripDetails.numberOfGuests}</span>
          </div>

          <div className="flex justify-between font-semibold">
            <span>Total Price:</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>${totalPrice.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AccommodationsList({
  toolCallId,
  tripDetails,
  accommodations,
}: {
  toolCallId: string;
  tripDetails: TripDetails;
  accommodations: Accommodation[];
}) {
  const thread = useStreamContext<
    { messages: Message[]; ui: UIMessage[] },
    { MetaType: { ui: UIMessage | undefined } }
  >();

  const [selectedAccommodation, setSelectedAccommodation] = useState<
    Accommodation | undefined
  >();
  const [accommodationBooked, setAccommodationBooked] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || accommodationBooked) return;
    const toolResponse = getToolResponse(toolCallId, thread);
    if (toolResponse) {
      setAccommodationBooked(true);
      try {
        const parsedContent: {
          accommodation: Accommodation;
          tripDetails: TripDetails;
        } = JSON.parse(toolResponse.content as string);
        setSelectedAccommodation(parsedContent.accommodation);
      } catch {
        console.error("Failed to parse tool response content.");
      }
    }
  }, []);

  function handleBookAccommodation(accommodation: Accommodation) {
    const orderDetails = {
      accommodation,
      tripDetails,
    };

    thread.submit({
      messages: [
        {
          type: "tool",
          tool_call_id: toolCallId,
          id: `${DO_NOT_RENDER_ID_PREFIX}${uuidv4()}`,
          name: "book-accommodation",
          content: JSON.stringify(orderDetails),
        },
        {
          type: "human",
          content: `Booked ${accommodation.name} for ${tripDetails.numberOfGuests}.`,
        },
      ],
    });

    setAccommodationBooked(true);
    if (selectedAccommodation?.id !== accommodation.id) {
      setSelectedAccommodation(accommodation);
    }
  }

  if (accommodationBooked && selectedAccommodation) {
    return (
      <BookedAccommodation
        tripDetails={tripDetails}
        accommodation={selectedAccommodation}
      />
    );
  } else if (accommodationBooked) {
    return <div>Successfully booked accommodation!</div>;
  }

  if (selectedAccommodation) {
    return (
      <SelectedAccommodation
        tripDetails={tripDetails}
        onHide={() => setSelectedAccommodation(undefined)}
        accommodation={selectedAccommodation}
        onBook={handleBookAccommodation}
      />
    );
  }

  return (
    <div className="space-y-8">
      <Carousel
        opts={{
          align: "start",
          loop: true,
        }}
        className="w-full sm:max-w-sm md:max-w-3xl lg:max-w-3xl"
      >
        <CarouselContent>
          {accommodations.map((accommodation) => (
            <CarouselItem
              key={accommodation.id}
              className="basis-1/2 md:basis-1/4"
              onClick={() => setSelectedAccommodation(accommodation)}
            >
              <AccommodationCard accommodation={accommodation} />
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
    </div>
  );
}
