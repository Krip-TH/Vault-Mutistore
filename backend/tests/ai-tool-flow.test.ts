import assert from 'node:assert/strict';
import test from 'node:test';
import type { FunctionCall } from '@google/genai';
import { databaseAssistantInstruction } from '../src/services/ai/databaseChatService.js';
import { databaseToolDeclarations, renderDatabaseToolFallback } from '../src/services/ai/databaseTools.js';
import { generateToolChatReply } from '../src/services/ai/geminiClient.js';
import type { ToolModelRequest, ToolModelResponse } from '../src/services/ai/geminiClient.js';

const productResult = {
  total_matches: 1,
  returned: 1,
  products: [{
    id: 'door-1', business: 'door', business_name: 'Door', name: 'ประตูไม้สัก',
    category: 'ประตูไม้', price: 12900, stock: 3, status: 'In Stock',
  }],
};

function toolCall(name: string, args: Record<string, unknown> = {}): FunctionCall {
  return { id: 'call-1', name, args };
}

async function runFlow(
  message: string,
  responses: (request: ToolModelRequest, requestNumber: number) => Promise<ToolModelResponse>,
  executeTool: (call: FunctionCall) => Promise<Record<string, unknown>> = async () => productResult,
) {
  let requestNumber = 0;
  let toolExecutions = 0;
  const reply = await generateToolChatReply({
    turns: [{ role: 'user', text: message }],
    systemInstruction: databaseAssistantInstruction(false),
    tools: databaseToolDeclarations,
    executeTool: async call => {
      toolExecutions += 1;
      return executeTool(call);
    },
    modelRequest: request => responses(request, ++requestNumber),
    renderToolFallback: renderDatabaseToolFallback,
  });
  return { reply, requestNumber, toolExecutions };
}

test('greeting returns direct Thai text without executing a tool', async () => {
  const result = await runFlow('สวัสดี', async request => {
    assert.equal(request.toolsEnabled, true);
    return { functionCalls: [], text: 'สวัสดีค่ะ มีอะไรให้ช่วยเกี่ยวกับ VAULT คะ' };
  });
  assert.equal(result.requestNumber, 1);
  assert.equal(result.toolExecutions, 0);
  assert.match(result.reply, /สวัสดี/);
});

test('wooden-door recommendation executes search_products once then returns Thai text', async () => {
  const call = toolCall('search_products', { query: 'ประตูไม้', in_stock_only: true });
  const result = await runFlow('แนะนำสินค้าประตูไม้', async (request, number) => {
    if (number === 1) return { functionCalls: [call], content: { role: 'model', parts: [{ functionCall: call }] } };
    assert.equal(request.toolsEnabled, false);
    assert.equal(request.contents.length, 3);
    const response = request.contents[2].parts?.[0].functionResponse;
    assert.equal(response?.id, call.id);
    assert.equal(response?.name, call.name);
    assert.deepEqual(response?.response, { output: productResult });
    return { functionCalls: [], text: 'แนะนำประตูไม้สัก ราคา 12,900 บาท มีสินค้า 3 ชิ้นค่ะ' };
  });
  assert.equal(result.requestNumber, 2);
  assert.equal(result.toolExecutions, 1);
  assert.match(result.reply, /ประตูไม้สัก/);
});

test('price and stock question uses one product tool and one final answer', async () => {
  const call = toolCall('search_products', { query: 'ประตูไม้สัก' });
  const result = await runFlow('ประตูไม้สักราคาเท่าไร มีของไหม', async (_request, number) => number === 1
    ? { functionCalls: [call], content: { role: 'model', parts: [{ functionCall: call }] } }
    : { functionCalls: [], text: 'ประตูไม้สักราคา 12,900 บาท เหลือ 3 ชิ้นค่ะ' });
  assert.equal(result.toolExecutions, 1);
  assert.match(result.reply, /12,900 บาท/);
  assert.match(result.reply, /3 ชิ้น/);
});

test('signed-out order question returns sign-in guidance without a customer tool', async () => {
  const result = await runFlow('คำสั่งซื้อล่าสุดของฉันอยู่ไหน', async () => ({
    functionCalls: [], text: 'กรุณาเข้าสู่ระบบก่อนเพื่อตรวจสอบคำสั่งซื้อของคุณค่ะ',
  }));
  assert.equal(result.toolExecutions, 0);
  assert.match(result.reply, /เข้าสู่ระบบ/);
});

test('a repeated disabled tool call returns grounded Thai data without a loop or 502', async () => {
  const call = toolCall('search_products', { query: 'ประตูไม้' });
  const result = await runFlow('แนะนำสินค้าประตูไม้', async (_request, number) => ({
    functionCalls: [call],
    content: number === 1 ? { role: 'model', parts: [{ functionCall: call }] } : undefined,
  }));
  assert.equal(result.requestNumber, 2);
  assert.equal(result.toolExecutions, 1);
  assert.match(result.reply, /ประตูไม้สัก/);
  assert.match(result.reply, /12,900/);
});

test('tool failure produces a graceful Thai response when Gemini repeats the disabled tool', async () => {
  const call = toolCall('search_products', { query: 'ประตูไม้' });
  const result = await runFlow(
    'แนะนำสินค้าประตูไม้',
    async (_request, number) => ({
      functionCalls: [call],
      content: number === 1 ? { role: 'model', parts: [{ functionCall: call }] } : undefined,
    }),
    async () => { throw new Error('store unavailable'); },
  );
  assert.equal(result.requestNumber, 2);
  assert.equal(result.toolExecutions, 1);
  assert.match(result.reply, /ไม่สามารถตรวจสอบข้อมูลล่าสุด/);
});
