import { test, expect, vi, beforeEach, describe } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockSignInAction = vi.fn();
const mockSignUpAction = vi.fn();
vi.mock("@/actions", () => ({
  signIn: (...args: unknown[]) => mockSignInAction(...args),
  signUp: (...args: unknown[]) => mockSignUpAction(...args),
}));

const mockGetAnonWorkData = vi.fn();
const mockClearAnonWork = vi.fn();
vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: () => mockGetAnonWorkData(),
  clearAnonWork: () => mockClearAnonWork(),
}));

const mockGetProjects = vi.fn();
vi.mock("@/actions/get-projects", () => ({
  getProjects: () => mockGetProjects(),
}));

const mockCreateProject = vi.fn();
vi.mock("@/actions/create-project", () => ({
  createProject: (...args: unknown[]) => mockCreateProject(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAnonWorkData.mockReturnValue(null);
  mockGetProjects.mockResolvedValue([]);
  mockCreateProject.mockResolvedValue({ id: "new-project-id" });
});

// ---------------------------------------------------------------------------
// signIn
// ---------------------------------------------------------------------------

describe("signIn", () => {
  test("returns the result from the signIn action", async () => {
    mockSignInAction.mockResolvedValue({ success: false, error: "Invalid credentials" });

    const { useAuth } = await import("@/hooks/use-auth");
    const { result } = renderHook(() => useAuth());

    let returnValue: unknown;
    await act(async () => {
      returnValue = await result.current.signIn("a@b.com", "wrongpass");
    });

    expect(returnValue).toEqual({ success: false, error: "Invalid credentials" });
  });

  test("sets isLoading to true while pending and false after", async () => {
    let resolveSignIn!: (v: unknown) => void;
    mockSignInAction.mockReturnValue(new Promise((r) => (resolveSignIn = r)));

    const { useAuth } = await import("@/hooks/use-auth");
    const { result } = renderHook(() => useAuth());

    act(() => {
      result.current.signIn("a@b.com", "password");
    });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolveSignIn({ success: false, error: "Invalid credentials" });
    });

    expect(result.current.isLoading).toBe(false);
  });

  test("resets isLoading even when the action throws", async () => {
    mockSignInAction.mockRejectedValue(new Error("Network error"));

    const { useAuth } = await import("@/hooks/use-auth");
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("a@b.com", "password").catch(() => {});
    });

    expect(result.current.isLoading).toBe(false);
  });

  test("does not redirect when sign-in fails", async () => {
    mockSignInAction.mockResolvedValue({ success: false, error: "Invalid credentials" });

    const { useAuth } = await import("@/hooks/use-auth");
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("a@b.com", "wrongpass");
    });

    expect(mockPush).not.toHaveBeenCalled();
    expect(mockCreateProject).not.toHaveBeenCalled();
  });

  test("calls signIn action with the provided credentials", async () => {
    mockSignInAction.mockResolvedValue({ success: false });

    const { useAuth } = await import("@/hooks/use-auth");
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("user@example.com", "secret123");
    });

    expect(mockSignInAction).toHaveBeenCalledWith("user@example.com", "secret123");
  });

  describe("post sign-in with anonymous work", () => {
    test("creates a project from anon work and redirects to it", async () => {
      const anonWork = {
        messages: [{ role: "user", content: "make a button" }],
        fileSystemData: { "/App.jsx": "export default () => <button />" },
      };
      mockSignInAction.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue(anonWork);
      mockCreateProject.mockResolvedValue({ id: "anon-project-id" });

      const { useAuth } = await import("@/hooks/use-auth");
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("a@b.com", "password");
      });

      expect(mockCreateProject).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: anonWork.messages,
          data: anonWork.fileSystemData,
        })
      );
      expect(mockClearAnonWork).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/anon-project-id");
    });

    test("does not fetch existing projects when anon work is present", async () => {
      mockSignInAction.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue({
        messages: [{ role: "user", content: "hi" }],
        fileSystemData: {},
      });
      mockCreateProject.mockResolvedValue({ id: "anon-project-id" });

      const { useAuth } = await import("@/hooks/use-auth");
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("a@b.com", "password");
      });

      expect(mockGetProjects).not.toHaveBeenCalled();
    });

    test("does not redirect to anon project when anonWork has no messages", async () => {
      mockSignInAction.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue({ messages: [], fileSystemData: {} });
      mockGetProjects.mockResolvedValue([{ id: "existing-project" }]);

      const { useAuth } = await import("@/hooks/use-auth");
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("a@b.com", "password");
      });

      expect(mockPush).toHaveBeenCalledWith("/existing-project");
    });
  });

  describe("post sign-in without anonymous work", () => {
    test("redirects to the most recent existing project", async () => {
      mockSignInAction.mockResolvedValue({ success: true });
      mockGetProjects.mockResolvedValue([
        { id: "recent-project" },
        { id: "older-project" },
      ]);

      const { useAuth } = await import("@/hooks/use-auth");
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("a@b.com", "password");
      });

      expect(mockPush).toHaveBeenCalledWith("/recent-project");
      expect(mockCreateProject).not.toHaveBeenCalled();
    });

    test("creates a new project and redirects when no existing projects", async () => {
      mockSignInAction.mockResolvedValue({ success: true });
      mockGetProjects.mockResolvedValue([]);
      mockCreateProject.mockResolvedValue({ id: "brand-new-project" });

      const { useAuth } = await import("@/hooks/use-auth");
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("a@b.com", "password");
      });

      expect(mockCreateProject).toHaveBeenCalledWith(
        expect.objectContaining({ messages: [], data: {} })
      );
      expect(mockPush).toHaveBeenCalledWith("/brand-new-project");
    });
  });
});

// ---------------------------------------------------------------------------
// signUp
// ---------------------------------------------------------------------------

describe("signUp", () => {
  test("returns the result from the signUp action", async () => {
    mockSignUpAction.mockResolvedValue({ success: false, error: "Email already registered" });

    const { useAuth } = await import("@/hooks/use-auth");
    const { result } = renderHook(() => useAuth());

    let returnValue: unknown;
    await act(async () => {
      returnValue = await result.current.signUp("a@b.com", "password");
    });

    expect(returnValue).toEqual({ success: false, error: "Email already registered" });
  });

  test("sets isLoading to true while pending and false after", async () => {
    let resolveSignUp!: (v: unknown) => void;
    mockSignUpAction.mockReturnValue(new Promise((r) => (resolveSignUp = r)));

    const { useAuth } = await import("@/hooks/use-auth");
    const { result } = renderHook(() => useAuth());

    act(() => {
      result.current.signUp("a@b.com", "password");
    });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolveSignUp({ success: false });
    });

    expect(result.current.isLoading).toBe(false);
  });

  test("resets isLoading even when the action throws", async () => {
    mockSignUpAction.mockRejectedValue(new Error("Network error"));

    const { useAuth } = await import("@/hooks/use-auth");
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signUp("a@b.com", "password").catch(() => {});
    });

    expect(result.current.isLoading).toBe(false);
  });

  test("does not redirect when sign-up fails", async () => {
    mockSignUpAction.mockResolvedValue({ success: false, error: "Email already registered" });

    const { useAuth } = await import("@/hooks/use-auth");
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signUp("a@b.com", "password");
    });

    expect(mockPush).not.toHaveBeenCalled();
    expect(mockCreateProject).not.toHaveBeenCalled();
  });

  test("calls signUp action with the provided credentials", async () => {
    mockSignUpAction.mockResolvedValue({ success: false });

    const { useAuth } = await import("@/hooks/use-auth");
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signUp("new@user.com", "mypassword");
    });

    expect(mockSignUpAction).toHaveBeenCalledWith("new@user.com", "mypassword");
  });

  test("runs post sign-in flow on success: creates project from anon work", async () => {
    const anonWork = {
      messages: [{ role: "user", content: "hello" }],
      fileSystemData: { "/App.jsx": "" },
    };
    mockSignUpAction.mockResolvedValue({ success: true });
    mockGetAnonWorkData.mockReturnValue(anonWork);
    mockCreateProject.mockResolvedValue({ id: "signup-anon-project" });

    const { useAuth } = await import("@/hooks/use-auth");
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signUp("new@user.com", "password");
    });

    expect(mockCreateProject).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: anonWork.messages,
        data: anonWork.fileSystemData,
      })
    );
    expect(mockClearAnonWork).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/signup-anon-project");
  });

  test("redirects to existing project on success when no anon work", async () => {
    mockSignUpAction.mockResolvedValue({ success: true });
    mockGetProjects.mockResolvedValue([{ id: "first-project" }]);

    const { useAuth } = await import("@/hooks/use-auth");
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signUp("new@user.com", "password");
    });

    expect(mockPush).toHaveBeenCalledWith("/first-project");
  });

  test("creates a new project and redirects on success when no anon work and no existing projects", async () => {
    mockSignUpAction.mockResolvedValue({ success: true });
    mockGetProjects.mockResolvedValue([]);
    mockCreateProject.mockResolvedValue({ id: "fresh-project" });

    const { useAuth } = await import("@/hooks/use-auth");
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signUp("new@user.com", "password");
    });

    expect(mockPush).toHaveBeenCalledWith("/fresh-project");
  });
});

// ---------------------------------------------------------------------------
// isLoading initial state
// ---------------------------------------------------------------------------

test("isLoading starts as false", async () => {
  const { useAuth } = await import("@/hooks/use-auth");
  const { result } = renderHook(() => useAuth());

  expect(result.current.isLoading).toBe(false);
});
