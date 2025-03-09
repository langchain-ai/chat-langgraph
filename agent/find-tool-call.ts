import { z, ZodTypeAny } from "zod";

interface ToolCall {
  name: string;
  args: Record<string, any>;
  id?: string;
  type?: "tool_call";
}

export function findToolCall<Name extends string>(name: Name) {
  return <Args extends ZodTypeAny>(
    x: ToolCall,
  ): x is { name: Name; args: z.infer<Args>; id?: string } => x.name === name;
}
