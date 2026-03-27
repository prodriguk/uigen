import { test, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ToolCallBadge, getLabel, getBasename } from "../ToolCallBadge";

afterEach(() => {
  cleanup();
});

// --- getBasename ---

test("getBasename returns filename from path", () => {
  expect(getBasename("/src/App.jsx")).toBe("App.jsx");
  expect(getBasename("/Card.jsx")).toBe("Card.jsx");
  expect(getBasename("App.jsx")).toBe("App.jsx");
});

// --- getLabel ---

test("getLabel: str_replace_editor create", () => {
  expect(getLabel("str_replace_editor", { command: "create", path: "/App.jsx" })).toBe("Creating App.jsx");
});

test("getLabel: str_replace_editor str_replace", () => {
  expect(getLabel("str_replace_editor", { command: "str_replace", path: "/Card.jsx" })).toBe("Editing Card.jsx");
});

test("getLabel: str_replace_editor insert", () => {
  expect(getLabel("str_replace_editor", { command: "insert", path: "/Card.jsx" })).toBe("Editing Card.jsx");
});

test("getLabel: str_replace_editor view", () => {
  expect(getLabel("str_replace_editor", { command: "view", path: "/App.jsx" })).toBe("Reading App.jsx");
});

test("getLabel: str_replace_editor undo_edit", () => {
  expect(getLabel("str_replace_editor", { command: "undo_edit", path: "/App.jsx" })).toBe("Undoing edit in App.jsx");
});

test("getLabel: file_manager rename", () => {
  expect(getLabel("file_manager", { command: "rename", path: "/OldName.jsx" })).toBe("Renaming OldName.jsx");
});

test("getLabel: file_manager delete", () => {
  expect(getLabel("file_manager", { command: "delete", path: "/OldName.jsx" })).toBe("Deleting OldName.jsx");
});

test("getLabel: unknown tool falls back to tool name", () => {
  expect(getLabel("some_unknown_tool", {})).toBe("some_unknown_tool");
});

// --- ToolCallBadge rendering ---

test("ToolCallBadge shows readable label when complete", () => {
  render(
    <ToolCallBadge
      toolInvocation={{
        toolCallId: "1",
        toolName: "str_replace_editor",
        args: { command: "create", path: "/App.jsx" },
        state: "result",
        result: "ok",
      }}
    />
  );

  expect(screen.getByText("Creating App.jsx")).toBeDefined();
});

test("ToolCallBadge shows green dot when state is result with result", () => {
  const { container } = render(
    <ToolCallBadge
      toolInvocation={{
        toolCallId: "1",
        toolName: "str_replace_editor",
        args: { command: "create", path: "/App.jsx" },
        state: "result",
        result: "ok",
      }}
    />
  );

  expect(container.querySelector(".bg-emerald-500")).toBeDefined();
  expect(container.querySelector(".animate-spin")).toBeNull();
});

test("ToolCallBadge shows spinner when state is call (in progress)", () => {
  const { container } = render(
    <ToolCallBadge
      toolInvocation={{
        toolCallId: "1",
        toolName: "str_replace_editor",
        args: { command: "str_replace", path: "/Card.jsx" },
        state: "call",
      }}
    />
  );

  expect(screen.getByText("Editing Card.jsx")).toBeDefined();
  expect(container.querySelector(".animate-spin")).toBeDefined();
  expect(container.querySelector(".bg-emerald-500")).toBeNull();
});

test("ToolCallBadge shows spinner when state is partial-call", () => {
  const { container } = render(
    <ToolCallBadge
      toolInvocation={{
        toolCallId: "1",
        toolName: "str_replace_editor",
        args: { command: "create", path: "/App.jsx" },
        state: "partial-call",
      }}
    />
  );

  expect(container.querySelector(".animate-spin")).toBeDefined();
});

test("ToolCallBadge falls back to tool name for unknown tools", () => {
  render(
    <ToolCallBadge
      toolInvocation={{
        toolCallId: "1",
        toolName: "unknown_tool",
        args: {},
        state: "result",
        result: "ok",
      }}
    />
  );

  expect(screen.getByText("unknown_tool")).toBeDefined();
});
