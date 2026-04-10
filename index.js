#!/usr/bin/env node
/**
 * Pancake_MCP PINPOINT
 * Implements Model Context Protocol over stdio (JSON-RPC 2.0)
 * Supports both:
 *   - External API: https://pos.pages.fm/api/v1  (api-key header)
 *   - Internal API: https://pancake.vn/api/v1    (access_token param)
 *
 * Usage:
 *   PANCAKE_API_KEY=your_key PANCAKE_PAGE_ID=your_page_id node index.js
 *
 * Or with JWT token (internal API):
 *   PANCAKE_JWT=your_jwt PANCAKE_PAGE_ID=your_page_id node index.js
 */

const https = require('https');
const readline = require('readline');

// ─── CONFIG ────────────────────────────────────────────────────────────────
const CONFIG = {
  apiKey:    process.env.PANCAKE_API_KEY   || '',
  jwt:       process.env.PANCAKE_JWT       || '',
  pageId:    process.env.PANCAKE_PAGE_ID   || '',
  // External API (official, requires API key from Settings > Application > API KEY)
  extBase:  'pos.pages.fm',
  extPath:  '/api/v1',
  // Internal API (requires JWT from Redux store)
  intBase:  'pancake.vn',
  intPath:  '/api/v1',
};

// Use internal API if JWT provided, otherwise external
const useInternal = () => !!CONFIG.jwt;

// ─── HTTP HELPER ────────────────────────────────────────────────────────────
function apiRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    let fullPath, host, headers = { 'Content-Type': 'application/json' };

    if (useInternal()) {
      host = CONFIG.intBase;
      const sep = path.includes('?') ? '&' : '?';
      fullPath = `${CONFIG.intPath}${path}${sep}access_token=${CONFIG.jwt}`;
    } else {
      host = CONFIG.extBase;
      fullPath = `${CONFIG.extPath}${path}`;
      headers['api-key'] = CONFIG.apiKey;
    }

    const options = {
      hostname: host,
      path: fullPath,
      method,
      headers,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: { raw: data.substring(0, 500) } });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ─── TOOL DEFINITIONS ───────────────────────────────────────────────────────
const TOOLS = [
  {
    name: 'pancake_get_conversations',
    description: 'Lấy danh sách hội thoại từ Pancake CRM. Có thể lọc theo nhãn (label), trạng thái, số lượng, và phân trang.',
    inputSchema: {
      type: 'object',
      properties: {
        page_id: {
          type: 'string',
          description: 'ID của Facebook Page (mặc định dùng PANCAKE_PAGE_ID từ env)',
        },
        limit: {
          type: 'number',
          description: 'Số hội thoại tối đa trả về (default: 20, max: 200)',
          default: 20,
        },
        tag_ids: {
          type: 'array',
          items: { type: 'number' },
          description: 'Lọc theo ID nhãn. VD: [3, 7] để lọc "Đang Tư Vấn" và "Đặt Lịch Hẹn"',
        },
        type: {
          type: 'string',
          enum: ['INBOX', 'COMMENT', 'ALL'],
          description: 'Loại hội thoại (default: INBOX)',
          default: 'INBOX',
        },
      },
      required: [],
    },
  },
  {
    name: 'pancake_get_messages',
    description: 'Lấy lịch sử tin nhắn của một hội thoại cụ thể trong Pancake.',
    inputSchema: {
      type: 'object',
      properties: {
        conversation_id: {
          type: 'string',
          description: 'ID hội thoại. Định dạng: PAGE_ID_PSID (VD: 103935705949084_26445369211738648)',
        },
        limit: {
          type: 'number',
          description: 'Số tin nhắn tối đa (default: 30)',
          default: 30,
        },
      },
      required: ['conversation_id'],
    },
  },
  {
    name: 'pancake_get_labels',
    description: 'Lấy danh sách tất cả nhãn (labels/tags) của một page trong Pancake CRM.',
    inputSchema: {
      type: 'object',
      properties: {
        page_id: {
          type: 'string',
          description: 'ID của Facebook Page (mặc định dùng PANCAKE_PAGE_ID từ env)',
        },
      },
      required: [],
    },
  },
  {
    name: 'pancake_get_label_stats',
    description: 'Thống kê số lượng hội thoại theo từng nhãn (label). Trả về bảng phân bổ lead theo nhãn.',
    inputSchema: {
      type: 'object',
      properties: {
        page_id: {
          type: 'string',
          description: 'ID của Facebook Page (mặc định dùng PANCAKE_PAGE_ID từ env)',
        },
        tag_ids: {
          type: 'array',
          items: { type: 'number' },
          description: 'Danh sách ID nhãn cần thống kê (để trống = tất cả nhãn)',
        },
        sample_limit: {
          type: 'number',
          description: 'Số hội thoại lấy mẫu mỗi nhãn để đếm (default: 200)',
          default: 200,
        },
      },
      required: [],
    },
  },
  {
    name: 'pancake_assign_label',
    description: 'Gán nhãn (label/tag) cho một hội thoại trong Pancake CRM.',
    inputSchema: {
      type: 'object',
      properties: {
        conversation_id: {
          type: 'string',
          description: 'ID hội thoại cần gán nhãn',
        },
        tag_ids: {
          type: 'array',
          items: { type: 'number' },
          description: 'Danh sách ID nhãn cần gán (thay thế toàn bộ nhãn hiện tại)',
        },
      },
      required: ['conversation_id', 'tag_ids'],
    },
  },
  {
    name: 'pancake_send_message',
    description: 'Gửi tin nhắn tới một hội thoại trong Pancake CRM.',
    inputSchema: {
      type: 'object',
      properties: {
        conversation_id: {
          type: 'string',
          description: 'ID hội thoại',
        },
        message: {
          type: 'string',
          description: 'Nội dung tin nhắn cần gửi',
        },
      },
      required: ['conversation_id', 'message'],
    },
  },
  {
    name: 'pancake_search_customers',
    description: 'Tìm kiếm khách hàng trong Pancake CRM theo tên hoặc số điện thoại.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Từ khóa tìm kiếm: tên khách hàng, SĐT, hoặc PSID',
        },
        page_id: {
          type: 'string',
          description: 'ID của Facebook Page (mặc định dùng PANCAKE_PAGE_ID từ env)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'pancake_get_page_info',
    description: 'Lấy thông tin tổng quan về page Pancake: tên, ID, số lượng nhãn, trạng thái kết nối.',
    inputSchema: {
      type: 'object',
      properties: {
        page_id: {
          type: 'string',
          description: 'ID của Facebook Page (mặc định dùng PANCAKE_PAGE_ID từ env)',
        },
      },
      required: [],
    },
  },
];

// ─── TOOL IMPLEMENTATIONS ───────────────────────────────────────────────────

async function pancake_get_conversations(args) {
  const pageId = args.page_id || CONFIG.pageId;
  if (!pageId) return { error: 'Thiếu page_id. Set PANCAKE_PAGE_ID hoặc truyền page_id.' };

  const limit = Math.min(args.limit || 20, 200);
  let path = `/pages/${pageId}/conversations?limit=${limit}`;

  if (args.tag_ids && args.tag_ids.length > 0) {
    path += args.tag_ids.map(id => `&tag_ids[]=${id}`).join('');
  }
  if (args.type && args.type !== 'ALL') {
    path += `&type=${args.type}`;
  }

  const res = await apiRequest(path);
  if (res.status !== 200) return { error: `API lỗi ${res.status}`, detail: res.data };

  const convs = res.data.conversations || [];
  return {
    total_returned: convs.length,
    conversations: convs.map(c => ({
      id: c.id,
      customer_name: c.customers?.[0]?.name || c.from?.name,
      customer_fb_id: c.from_psid,
      labels: c.tags || [],
      snippet: c.snippet,
      unread_count: c.unread_count,
      last_sent_by: c.last_sent_by?.admin_name || c.last_sent_by?.name,
      updated_at: c.updated_at,
      message_count: c.message_count,
      has_phone: c.has_phone,
    })),
  };
}

async function pancake_get_messages(args) {
  if (!args.conversation_id) return { error: 'Thiếu conversation_id' };

  const limit = args.limit || 30;

  // Try internal API path for messages
  const path = `/conversations/${args.conversation_id}/messages?limit=${limit}`;
  const res = await apiRequest(path);

  if (res.status !== 200) {
    // Fallback: try with page path
    const pageId = CONFIG.pageId;
    const path2 = `/pages/${pageId}/conversations/${args.conversation_id}/messages?limit=${limit}`;
    const res2 = await apiRequest(path2);
    if (res2.status !== 200) return { error: `API lỗi ${res.status}`, detail: res.data };

    const msgs2 = res2.data.messages || res2.data || [];
    return formatMessages(msgs2, args.conversation_id);
  }

  const msgs = res.data.messages || res.data || [];
  return formatMessages(msgs, args.conversation_id);
}

function formatMessages(msgs, convId) {
  if (!Array.isArray(msgs)) return { conversation_id: convId, raw: msgs };
  return {
    conversation_id: convId,
    total: msgs.length,
    messages: msgs.map(m => ({
      id: m.id,
      from: m.from?.name || (m.is_page_sender ? 'Page' : 'Customer'),
      is_page_sender: m.is_page_sender,
      message: m.message,
      type: m.type,
      sent_at: m.created_time || m.inserted_at,
      attachments: m.attachments?.length || 0,
    })),
  };
}

async function pancake_get_labels(args) {
  const pageId = args.page_id || CONFIG.pageId;
  if (!pageId) return { error: 'Thiếu page_id' };

  // Internal API: page settings includes tags
  const res = await apiRequest(`/pages/${pageId}/settings`);
  if (res.status === 200 && res.data.tags) {
    return {
      page_id: pageId,
      total_labels: res.data.tags.length,
      labels: res.data.tags.map(t => ({
        id: t.id,
        name: t.text,
        color: t.color,
        description: t.description,
      })),
    };
  }

  // Fallback: external API
  const res2 = await apiRequest(`/pages/${pageId}/tags`);
  if (res2.status === 200) {
    const tags = res2.data.tags || res2.data || [];
    return {
      page_id: pageId,
      total_labels: tags.length,
      labels: tags.map(t => ({
        id: t.id,
        name: t.text || t.name,
        color: t.color,
        description: t.description,
      })),
    };
  }

  return { error: `Không lấy được labels. Status: ${res2.status}`, detail: res2.data };
}

async function pancake_get_label_stats(args) {
  const pageId = args.page_id || CONFIG.pageId;
  if (!pageId) return { error: 'Thiếu page_id' };

  const sampleLimit = args.sample_limit || 200;

  // Get all labels first
  const labelsResult = await pancake_get_labels({ page_id: pageId });
  if (labelsResult.error) return labelsResult;

  let tagList = labelsResult.labels;
  if (args.tag_ids && args.tag_ids.length > 0) {
    tagList = tagList.filter(t => args.tag_ids.includes(t.id));
  }

  const stats = [];
  for (const tag of tagList) {
    try {
      const path = `/pages/${pageId}/conversations?limit=${sampleLimit}&tag_ids[]=${tag.id}`;
      const res = await apiRequest(path);
      const count = (res.data.conversations || []).length;
      stats.push({
        label_id: tag.id,
        label_name: tag.name,
        color: tag.color,
        conversation_count: count,
        note: count >= sampleLimit ? `≥${sampleLimit} (có thể còn nhiều hơn)` : `chính xác`,
      });
      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 200));
    } catch (e) {
      stats.push({ label_id: tag.id, label_name: tag.name, error: e.message });
    }
  }

  stats.sort((a, b) => (b.conversation_count || 0) - (a.conversation_count || 0));

  return {
    page_id: pageId,
    total_labels_checked: stats.length,
    sample_size_per_label: sampleLimit,
    label_stats: stats,
    summary: `Top 5: ${stats.slice(0, 5).map(s => `${s.label_name}(${s.conversation_count})`).join(', ')}`,
  };
}

async function pancake_assign_label(args) {
  if (!args.conversation_id) return { error: 'Thiếu conversation_id' };
  if (!args.tag_ids) return { error: 'Thiếu tag_ids' };

  const path = `/conversations/${args.conversation_id}/tags`;
  const res = await apiRequest(path, 'PUT', { tag_ids: args.tag_ids });

  if (res.status === 200) {
    return { success: true, conversation_id: args.conversation_id, assigned_tags: args.tag_ids };
  }

  // Try POST
  const res2 = await apiRequest(path, 'POST', { tag_ids: args.tag_ids });
  if (res2.status === 200) {
    return { success: true, conversation_id: args.conversation_id, assigned_tags: args.tag_ids };
  }

  return { error: `Gán nhãn thất bại (${res.status})`, detail: res.data };
}

async function pancake_send_message(args) {
  if (!args.conversation_id) return { error: 'Thiếu conversation_id' };
  if (!args.message) return { error: 'Thiếu nội dung message' };

  // Extract PSID and page_id from conversation_id (format: PAGE_ID_PSID)
  const parts = args.conversation_id.split('_');
  const pageId = parts[0] || CONFIG.pageId;
  const psid = parts[1];

  const path = `/pages/${pageId}/messages`;
  const body = {
    recipient: { id: psid },
    message: { text: args.message },
  };

  const res = await apiRequest(path, 'POST', body);
  if (res.status === 200 || res.status === 201) {
    return { success: true, message_id: res.data.message_id || res.data.id };
  }

  return { error: `Gửi tin thất bại (${res.status})`, detail: res.data };
}

async function pancake_search_customers(args) {
  if (!args.query) return { error: 'Thiếu query' };
  const pageId = args.page_id || CONFIG.pageId;
  if (!pageId) return { error: 'Thiếu page_id' };

  const path = `/pages/${pageId}/customers?q=${encodeURIComponent(args.query)}&limit=20`;
  const res = await apiRequest(path);

  if (res.status === 200) {
    const customers = res.data.customers || res.data || [];
    return {
      query: args.query,
      total_found: customers.length,
      customers: Array.isArray(customers) ? customers.map(c => ({
        id: c.id,
        name: c.name,
        fb_id: c.fb_id,
        phone: c.phone_number || c.phone,
        email: c.email,
        tags: c.tags,
        last_interaction: c.last_interaction_at || c.updated_at,
      })) : customers,
    };
  }

  // Fallback: search via conversations snippet
  const convPath = `/pages/${pageId}/conversations?limit=50`;
  const convRes = await apiRequest(convPath);
  if (convRes.status === 200) {
    const q = args.query.toLowerCase();
    const found = (convRes.data.conversations || []).filter(c =>
      (c.customers?.[0]?.name || '').toLowerCase().includes(q) ||
      (c.from?.name || '').toLowerCase().includes(q) ||
      (c.recent_phone_numbers || []).some(p => p.includes(args.query))
    );
    return {
      query: args.query,
      total_found: found.length,
      note: 'Tìm kiếm trong 50 hội thoại gần nhất',
      customers: found.map(c => ({
        name: c.customers?.[0]?.name || c.from?.name,
        fb_id: c.from_psid,
        conversation_id: c.id,
        has_phone: c.has_phone,
        phones: c.recent_phone_numbers,
        last_updated: c.updated_at,
      })),
    };
  }

  return { error: `Tìm kiếm thất bại (${res.status})`, detail: res.data };
}

async function pancake_get_page_info(args) {
  const pageId = args.page_id || CONFIG.pageId;
  if (!pageId) return { error: 'Thiếu page_id. Set PANCAKE_PAGE_ID trong env.' };

  const res = await apiRequest(`/pages/${pageId}/settings`);
  if (res.status !== 200) {
    return { error: `Không lấy được thông tin page (${res.status})`, page_id: pageId };
  }

  const data = res.data;
  return {
    page_id: pageId,
    api_mode: useInternal() ? 'internal (JWT)' : 'external (api-key)',
    settings_loaded: true,
    tags_count: data.tags?.length || 0,
    has_webhook: !!data.webhook_url,
    platform: data.platform,
    status: 'connected',
  };
}

// ─── TOOL DISPATCHER ─────────────────────────────────────────────────────────
async function callTool(name, args) {
  switch (name) {
    case 'pancake_get_conversations':  return await pancake_get_conversations(args);
    case 'pancake_get_messages':       return await pancake_get_messages(args);
    case 'pancake_get_labels':         return await pancake_get_labels(args);
    case 'pancake_get_label_stats':    return await pancake_get_label_stats(args);
    case 'pancake_assign_label':       return await pancake_assign_label(args);
    case 'pancake_send_message':       return await pancake_send_message(args);
    case 'pancake_search_customers':   return await pancake_search_customers(args);
    case 'pancake_get_page_info':      return await pancake_get_page_info(args);
    default: return { error: `Tool không tồn tại: ${name}` };
  }
}

// ─── JSON-RPC 2.0 / MCP PROTOCOL ────────────────────────────────────────────
function send(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

function makeResult(id, result) {
  return { jsonrpc: '2.0', id, result };
}

function makeError(id, code, message) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

async function handleMessage(msg) {
  let req;
  try {
    req = JSON.parse(msg);
  } catch (e) {
    send(makeError(null, -32700, 'Parse error'));
    return;
  }

  const { id, method, params } = req;

  // MCP Lifecycle
  if (method === 'initialize') {
    send(makeResult(id, {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'Pancake_MCP PINPOINT', version: '1.0.0' },
    }));
    return;
  }

  if (method === 'notifications/initialized' || method === 'initialized') {
    return; // no response needed
  }

  if (method === 'ping') {
    send(makeResult(id, {}));
    return;
  }

  // Tools
  if (method === 'tools/list') {
    send(makeResult(id, { tools: TOOLS }));
    return;
  }

  if (method === 'tools/call') {
    const toolName = params?.name;
    const toolArgs = params?.arguments || {};
    try {
      const result = await callTool(toolName, toolArgs);
      send(makeResult(id, {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      }));
    } catch (e) {
      send(makeResult(id, {
        content: [{ type: 'text', text: JSON.stringify({ error: e.message }) }],
        isError: true,
      }));
    }
    return;
  }

  // Resources (not implemented)
  if (method === 'resources/list') {
    send(makeResult(id, { resources: [] }));
    return;
  }

  if (method === 'prompts/list') {
    send(makeResult(id, { prompts: [] }));
    return;
  }

  send(makeError(id, -32601, `Method not found: ${method}`));
}

// ─── STDIO TRANSPORT ─────────────────────────────────────────────────────────
const rl = readline.createInterface({ input: process.stdin, terminal: false });

rl.on('line', (line) => {
  const trimmed = line.trim();
  if (trimmed) handleMessage(trimmed);
});

rl.on('close', () => process.exit(0));

// Startup validation
if (!CONFIG.apiKey && !CONFIG.jwt) {
  process.stderr.write(
    '[Pancake_MCP PINPOINT] ⚠️  Chưa có credentials!\n' +
    '  Set PANCAKE_API_KEY=your_key (external API)\n' +
    '  hoặc PANCAKE_JWT=your_jwt (internal API)\n' +
    '  và PANCAKE_PAGE_ID=your_page_id\n'
  );
}

process.stderr.write(
  `[Pancake_MCP PINPOINT] ✅ Server started | mode: ${useInternal() ? 'JWT/internal' : 'api-key/external'} | page: ${CONFIG.pageId || 'not set'}\n`
);
