export const toolTemplates = [
  {
    name: "get_weather",
    type: "function",
    description: "Get the current weather",
    parameters: {
      type: "object",
      properties: {
        location: { type: "string" },
      },
    },
  },
  {
    name: "ping_no_args",
    type: "function",
    description: "A simple ping tool with no arguments",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_user_nested_args",
    type: "function",
    description: "Fetch user profile by nested identifier",
    parameters: {
      type: "object",
      properties: {
        user: {
          type: "object",
          properties: {
            id: { type: "string" },
            metadata: {
              type: "object",
              properties: {
                region: { type: "string" },
                role: { type: "string" },
              },
            },
          },
        },
      },
    },
  },
  {
    name: "calculate_route_more_properties",
    type: "function",
    description: "Calculate travel route with multiple parameters",
    parameters: {
      type: "object",
      properties: {
        start: { type: "string" },
        end: { type: "string" },
        mode: { type: "string", enum: ["car", "bike", "walk"] },
        options: {
          type: "object",
          properties: {
            avoid_highways: { type: "boolean" },
            scenic_route: { type: "boolean" },
          },
        },
      },
    },
  },
  {
    name: "code_executor",
    type: "tool",
    tool: "code_interpreter",
    display_name: "Code Interpreter",
    description:
      "Execute Python code in an isolated sandbox and return stdout/stderr.",
  },
  {
    name: "files_search",
    type: "tool",
    tool: "file_search",
    display_name: "File Search",
    description:
      "Search across embedded documents and return ranked excerpts for grounding.",
    settings: {
      max_results: 5,
    },
  },
  {
    name: "structured_data_lookup",
    type: "tool",
    tool: "structured_data",
    display_name: "Structured Data",
    description:
      "Query structured datasets using natural language and structured filters.",
    settings: {
      dataset_id: "example-dataset",
      confidence_threshold: 0.6,
    },
  },
];
