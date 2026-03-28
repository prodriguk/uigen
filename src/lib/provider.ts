import { anthropic } from "@ai-sdk/anthropic";
import {
  LanguageModelV2,
  LanguageModelV2StreamPart,
  LanguageModelV2CallOptions,
} from "@ai-sdk/provider";

const MODEL = "claude-haiku-4-5";

export class MockLanguageModel implements LanguageModelV2 {
  readonly specificationVersion = "v2" as const;
  readonly provider = "mock";
  readonly modelId: string;
  readonly supportedUrls = {};

  constructor(modelId: string) {
    this.modelId = modelId;
  }

  private async delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private extractUserPrompt(prompt: LanguageModelV2CallOptions["prompt"]): string {
    for (let i = prompt.length - 1; i >= 0; i--) {
      const message = prompt[i];
      if (message.role === "user") {
        const content = message.content;
        return content
          .filter((part) => part.type === "text")
          .map((part) => (part as { type: "text"; text: string }).text)
          .join(" ");
      }
    }
    return "";
  }

  private countToolMessages(prompt: LanguageModelV2CallOptions["prompt"]): number {
    return prompt.filter((m) => m.role === "tool").length;
  }

  private async *generateMockStream(
    prompt: LanguageModelV2CallOptions["prompt"],
    userPrompt: string
  ): AsyncGenerator<LanguageModelV2StreamPart> {
    const toolMessageCount = this.countToolMessages(prompt);

    const promptLower = userPrompt.toLowerCase();
    let componentType = "counter";
    let componentName = "Counter";

    if (promptLower.includes("form")) {
      componentType = "form";
      componentName = "ContactForm";
    } else if (promptLower.includes("card") || promptLower.includes("pricing")) {
      componentType = "card";
      componentName = "PricingCard";
    }

    yield { type: "stream-start", warnings: [] };

    // Single step: create the component and App.jsx together
    if (toolMessageCount === 0) {
      const textId = "text-1";
      const text = `I'll create a ${componentName} component for you. Note: add an Anthropic API key to .env to use the real AI.`;

      yield { type: "text-start", id: textId };
      for (const char of text) {
        yield { type: "text-delta", id: textId, delta: char };
        await this.delay(10);
      }
      yield { type: "text-end", id: textId };

      // Create the component file first
      yield {
        type: "tool-call",
        toolCallId: "call_1",
        toolName: "str_replace_editor",
        input: JSON.stringify({
          command: "create",
          path: `/components/${componentName}.jsx`,
          file_text: this.getComponentCode(componentType),
        }),
      };

      // Then create App.jsx that imports it
      yield {
        type: "tool-call",
        toolCallId: "call_2",
        toolName: "str_replace_editor",
        input: JSON.stringify({
          command: "create",
          path: "/App.jsx",
          file_text: this.getAppCode(componentName),
        }),
      };

      yield {
        type: "finish",
        finishReason: "tool-calls",
        usage: { inputTokens: 50, outputTokens: 100, totalTokens: 150 },
      };
      return;
    }

    // Subsequent steps: just finish
    const textId = "text-2";
    const text = `Done! The ${componentName} component is ready. You can see the preview on the right.`;

    yield { type: "text-start", id: textId };
    for (const char of text) {
      yield { type: "text-delta", id: textId, delta: char };
      await this.delay(20);
    }
    yield { type: "text-end", id: textId };

    yield {
      type: "finish",
      finishReason: "stop",
      usage: { inputTokens: 50, outputTokens: 50, totalTokens: 100 },
    };
  }

  private getComponentCode(componentType: string): string {
    switch (componentType) {
      case "form":
        return `import React, { useState } from 'react';

const ContactForm = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: ''
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Form submitted:', formData);
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">Contact Us</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
            Message
          </label>
          <textarea
            id="message"
            name="message"
            value={formData.message}
            onChange={handleChange}
            required
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          type="submit"
          className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 transition-colors"
        >
          Send Message
        </button>
      </form>
    </div>
  );
};

export default ContactForm;`;

      case "card":
        return `import React from 'react';

const features = [
  "Unlimited projects",
  "Priority support",
  "Advanced analytics",
  "Custom integrations",
  "99.9% uptime SLA",
];

const PricingCard = () => {
  return (
    <div className="relative bg-gradient-to-br from-violet-950 to-indigo-950 rounded-3xl p-8 ring-1 ring-white/10 shadow-2xl shadow-violet-950/50 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 via-transparent to-indigo-500/5 pointer-events-none" />

      <div className="relative">
        <span className="inline-block px-3 py-1 text-xs font-semibold tracking-widest text-violet-300 uppercase bg-violet-500/20 rounded-full mb-6">
          Pro Plan
        </span>

        <div className="mb-6">
          <div className="flex items-end gap-1">
            <span className="text-5xl font-bold tracking-tight text-white">$49</span>
            <span className="text-violet-400 mb-2 text-lg">/month</span>
          </div>
          <p className="text-violet-300/70 text-sm mt-1 leading-relaxed">
            Everything you need to scale your product.
          </p>
        </div>

        <ul className="space-y-3 mb-8">
          {features.map((feature) => (
            <li key={feature} className="flex items-center gap-3 text-sm text-violet-100">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-violet-500/30 ring-1 ring-violet-400/40 flex items-center justify-center text-violet-300 text-xs">
                ✓
              </span>
              {feature}
            </li>
          ))}
        </ul>

        <button className="w-full py-3 px-6 rounded-2xl font-semibold text-sm tracking-wide bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 hover:brightness-110 hover:scale-[1.02] transition-all duration-200">
          Get started
        </button>

        <p className="text-center text-xs text-violet-400/60 mt-4">
          No credit card required · Cancel anytime
        </p>
      </div>
    </div>
  );
};

export default PricingCard;`;

      default:
        return `import { useState } from 'react';

const Counter = () => {
  const [count, setCount] = useState(0);

  return (
    <div className="flex flex-col items-center p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Counter</h2>
      <div className="text-4xl font-bold mb-6">{count}</div>
      <div className="flex gap-4">
        <button
          onClick={() => setCount(count - 1)}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
        >
          Decrease
        </button>
        <button
          onClick={() => setCount(0)}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
        >
          Reset
        </button>
        <button
          onClick={() => setCount(count + 1)}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
        >
          Increase
        </button>
      </div>
    </div>
  );
};

export default Counter;`;
    }
  }

  private getOldStringForReplace(componentType: string): string {
    switch (componentType) {
      case "form":
        return "    console.log('Form submitted:', formData);";
      case "card":
        return '      <div className="p-6">';
      default:
        return '  const [count, setCount] = useState(0);';
    }
  }

  private getNewStringForReplace(componentType: string): string {
    switch (componentType) {
      case "form":
        return "    console.log('Form submitted:', formData);\n    alert('Thank you! We\\'ll get back to you soon.');";
      case "card":
        return '      <div className="p-6 hover:bg-gray-50 transition-colors">';
      default:
        return '  const [count, setCount] = useState(0);\n  const [step, setStep] = useState(1);';
    }
  }

  private getAppCode(componentName: string): string {
    if (componentName === "Card") {
      return `import PricingCard from '@/components/PricingCard';

export default function App() {
  return (
    <div className="min-h-screen bg-[#0a0514] flex items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <PricingCard />
      </div>
    </div>
  );
}`;
    }

    return `import ${componentName} from '@/components/${componentName}';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        <${componentName} />
      </div>
    </div>
  );
}`;
  }

  async doGenerate(
    options: LanguageModelV2CallOptions
  ): Promise<Awaited<ReturnType<LanguageModelV2["doGenerate"]>>> {
    const userPrompt = this.extractUserPrompt(options.prompt);

    const parts: LanguageModelV2StreamPart[] = [];
    for await (const part of this.generateMockStream(options.prompt, userPrompt)) {
      parts.push(part);
    }

    const content: Array<{ type: "text"; text: string } | { type: "tool-call"; toolCallId: string; toolName: string; input: string }> = [];

    let currentText = "";
    for (const part of parts) {
      if (part.type === "text-delta") {
        currentText += part.delta;
      } else if (part.type === "text-end" && currentText) {
        content.push({ type: "text", text: currentText });
        currentText = "";
      } else if (part.type === "tool-call") {
        content.push({ type: "tool-call", toolCallId: part.toolCallId, toolName: part.toolName, input: part.input });
      }
    }

    const finishPart = parts.find((p) => p.type === "finish") as { type: "finish"; finishReason: string; usage: { inputTokens: number; outputTokens: number; totalTokens: number } } | undefined;

    return {
      content: content as any,
      finishReason: (finishPart?.finishReason ?? "stop") as any,
      usage: finishPart?.usage ?? { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
      warnings: [],
    };
  }

  async doStream(
    options: LanguageModelV2CallOptions
  ): Promise<Awaited<ReturnType<LanguageModelV2["doStream"]>>> {
    const userPrompt = this.extractUserPrompt(options.prompt);
    const self = this;

    const stream = new ReadableStream<LanguageModelV2StreamPart>({
      async start(controller) {
        try {
          const generator = self.generateMockStream(options.prompt, userPrompt);
          for await (const chunk of generator) {
            controller.enqueue(chunk);
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return { stream };
  }
}

export function getLanguageModel() {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey || apiKey.trim() === "") {
    console.log("No ANTHROPIC_API_KEY found, using mock provider");
    return new MockLanguageModel("mock-claude-haiku-4-5");
  }

  return anthropic(MODEL);
}
