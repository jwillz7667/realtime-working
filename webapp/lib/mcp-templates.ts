export const mcpServerTemplates = [
  {
    name: "docs_mcp",
    type: "mcp",
    transport: {
      type: "websocket",
      url: "wss://example-mcp.your-domain.dev",
      headers: {
        Authorization: "Bearer ${MCP_API_KEY}",
      },
    },
    capabilities: ["tool_invocation", "resource_read"],
  },
  {
    name: "local_files_mcp",
    type: "mcp",
    transport: {
      type: "http",
      url: "http://127.0.0.1:9090/mcp",
    },
    credentials: {
      type: "token",
      token: "${LOCAL_TOKEN}",
    },
  },
];
