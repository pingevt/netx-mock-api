/**
 * JSON-RPC 2.0 dispatcher
 *
 * Routes incoming method calls to their handler functions and wraps
 * responses in the standard JSON-RPC envelope.
 */

const methods = require('./methods');


/**
 * Main RPC handler - mounted at POST /api/rpc
 */
function handleRpc(req, res) {
  const { jsonrpc, id, method, params = [] } = req.body;

  if (jsonrpc !== '2.0') {
    return res.status(400).json(rpcError(id, -32600, 'Invalid JSON-RPC version'));
  }

  if (!method) {
    return res.status(400).json(rpcError(id, -32600, 'Missing method'));
  }

  const handler = methods[method];

  if (!handler) {
    console.warn(`[RPC] Unknown method: ${method}`);
    return res.json(rpcError(id, -32601, `Method not found: ${method}`));
  }

  try {
    console.log(`[RPC] ${method}`, JSON.stringify(params).slice(0, 120));
    const result = handler(params);
    return res.json(rpcSuccess(id, result));
  } catch (err) {
    console.error(`[RPC] Error in ${method}:`, err.message);
    return res.json(rpcError(id, -32000, err.message));
  }
}

function rpcSuccess(id, result) {
  return { jsonrpc: '2.0', id: String(id), result };
}

function rpcError(id, code, message, data = undefined) {
  const error = { code, message };
  if (data !== undefined) error.data = data;
  return { jsonrpc: '2.0', id: id ? String(id) : null, error };
}

module.exports = { handleRpc };
