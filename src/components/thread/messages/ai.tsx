import { useStreamContext } from "@/providers/Stream";
import { Checkpoint, Message } from "@langchain/langgraph-sdk";
import { getContentString } from "../utils";
import { BranchSwitcher, CommandBar } from "./shared";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MarkdownText } from "../markdown-text";
import { LoadExternalComponent } from "@langchain/langgraph-sdk/react-ui/client";
import { cn } from "@/lib/utils";

function CustomComponent({
  message,
  thread,
}: {
  message: Message;
  thread: ReturnType<typeof useStreamContext>;
}) {
  const meta = thread.getMessagesMetadata(message);
  const seenState = meta?.firstSeenState;
  const customComponent = seenState?.values.ui
    .slice()
    .reverse()
    .find(
      ({ additional_kwargs }) =>
        additional_kwargs.run_id === seenState.metadata?.run_id,
    );

  if (!customComponent) {
    return null;
  }

  return (
    <div key={message.id}>
      {customComponent && (
        <LoadExternalComponent
          assistantId="agent"
          stream={thread}
          message={customComponent}
        />
      )}
    </div>
  );
}

export function AssistantMessage({
  message,
  isLoading,
  handleRegenerate,
}: {
  message: Message;
  isLoading: boolean;
  handleRegenerate: (parentCheckpoint: Checkpoint | null | undefined) => void;
}) {
  const contentString = getContentString(message.content);

  const thread = useStreamContext();
  const meta = thread.getMessagesMetadata(message);
  const parentCheckpoint = meta?.firstSeenState?.parent_checkpoint;

  return (
    <div className="flex items-start mr-auto gap-2 group">
      <Avatar>
        <AvatarFallback>A</AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-2">
        <CustomComponent message={message} thread={thread} />
        {contentString.length > 0 && (
          <div className="rounded-2xl bg-muted px-4 py-2">
            <MarkdownText>{contentString}</MarkdownText>
          </div>
        )}
        <div
          className={cn(
            "flex gap-2 items-center mr-auto transition-opacity",
            "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100",
          )}
        >
          <BranchSwitcher
            branch={meta?.branch}
            branchOptions={meta?.branchOptions}
            onSelect={(branch) => thread.setBranch(branch)}
            isLoading={isLoading}
          />
          <CommandBar
            content={contentString}
            isLoading={isLoading}
            isAiMessage={true}
            handleRegenerate={() => handleRegenerate(parentCheckpoint)}
          />
        </div>
      </div>
    </div>
  );
}

export function AssistantMessageLoading() {
  return (
    <div className="flex items-start mr-auto gap-2">
      <Avatar>
        <AvatarFallback>A</AvatarFallback>
      </Avatar>
      <div className="flex items-center gap-1 rounded-2xl bg-muted px-4 py-2 h-8">
        <div className="w-1.5 h-1.5 rounded-full bg-foreground/50 animate-[pulse_1.5s_ease-in-out_infinite]"></div>
        <div className="w-1.5 h-1.5 rounded-full bg-foreground/50 animate-[pulse_1.5s_ease-in-out_0.5s_infinite]"></div>
        <div className="w-1.5 h-1.5 rounded-full bg-foreground/50 animate-[pulse_1.5s_ease-in-out_1s_infinite]"></div>
      </div>
    </div>
  );
}
