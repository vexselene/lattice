const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const native = require('./native');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lattice-test-p2-'));
native.initApp(tmpDir);

async function runTests() {
  console.log('=== STARTING AUTOMATED ROUND-TRIP VERIFICATION ===');

  // Setup & Unlock
  await native.cmdAuthSetup('test-master-password');
  await native.cmdAuthUnlock('test-master-password');

  // 1. Create a node of each type -> read it back -> matches
  // 1a. Email
  const emailNode = native.cmdCreateNode('email', {
    address: 'alice@example.com',
    provider: 'ProtonMail',
    password_raw: 'emailsecret123',
    notes: 'Alice personal email',
    tags: ['personal', 'primary'],
    position_x: 100,
    position_y: 150,
  });
  assert.strictEqual(emailNode.type, 'email');
  assert.strictEqual(emailNode.data.address, 'alice@example.com');
  assert.strictEqual(emailNode.data.provider, 'ProtonMail');
  assert.strictEqual(emailNode.data.notes, 'Alice personal email');
  assert.deepStrictEqual(emailNode.data.tags, ['personal', 'primary']);
  assert.strictEqual(emailNode.data.position_x, 100);
  assert.strictEqual(emailNode.data.position_y, 150);

  const readEmail = native.cmdGetNode('email', emailNode.data.id);
  assert.strictEqual(readEmail.data.id, emailNode.data.id);
  assert.strictEqual(readEmail.data.address, 'alice@example.com');
  console.log('cmd_create_node (email) & cmd_get_node: PASS');

  // 1b. Phone
  const phoneNode = native.cmdCreateNode('phone', {
    number: '+15551234567',
    carrier: 'Verizon',
    notes: 'Work phone',
    tags: ['work'],
    position_x: 200,
    position_y: 250,
  });
  assert.strictEqual(phoneNode.type, 'phone');
  assert.strictEqual(phoneNode.data.number, '+15551234567');
  assert.strictEqual(phoneNode.data.carrier, 'Verizon');
  const readPhone = native.cmdGetNode('phone', phoneNode.data.id);
  assert.strictEqual(readPhone.data.id, phoneNode.data.id);
  assert.strictEqual(readPhone.data.number, '+15551234567');
  console.log('cmd_create_node (phone) & cmd_get_node: PASS');

  // 1c. Service
  const serviceNode = native.cmdCreateNode('service', {
    name: 'GitHub',
    url: 'https://github.com',
    category: 'Development',
    icon_url: 'https://github.com/icon.png',
    notes: 'Code hosting',
    tags: ['dev'],
    position_x: 300,
    position_y: 350,
  });
  assert.strictEqual(serviceNode.type, 'service');
  assert.strictEqual(serviceNode.data.name, 'GitHub');
  const readService = native.cmdGetNode('service', serviceNode.data.id);
  assert.strictEqual(readService.data.id, serviceNode.data.id);
  assert.strictEqual(readService.data.name, 'GitHub');
  console.log('cmd_create_node (service) & cmd_get_node: PASS');

  // 1d. Account
  const accountNode = native.cmdCreateNode('account', {
    username: 'alice_dev',
    service_id: serviceNode.data.id,
    primary_email_id: emailNode.data.id,
    password_raw: 'gh_secret_456',
    notes: 'Alice GitHub account',
    tags: ['dev'],
    position_x: 400,
    position_y: 450,
  });
  assert.strictEqual(accountNode.type, 'account');
  assert.strictEqual(accountNode.data.username, 'alice_dev');
  assert.strictEqual(accountNode.data.service_id, serviceNode.data.id);
  assert.strictEqual(accountNode.data.primary_email_id, emailNode.data.id);
  const readAccount = native.cmdGetNode('account', accountNode.data.id);
  assert.strictEqual(readAccount.data.id, accountNode.data.id);
  assert.strictEqual(readAccount.data.username, 'alice_dev');
  console.log('cmd_create_node (account) & cmd_get_node: PASS');

  // 2. Passwords decrypted via cmd_get_node_password
  const emailPwd = native.cmdGetNodePassword('email', emailNode.data.id);
  assert.strictEqual(emailPwd, 'emailsecret123');
  const accountPwd = native.cmdGetNodePassword('account', accountNode.data.id);
  assert.strictEqual(accountPwd, 'gh_secret_456');
  console.log('cmd_get_node_password: PASS');

  // 3. Update node -> persists
  const updatedEmail = native.cmdUpdateNode('email', emailNode.data.id, {
    address: 'alice_updated@example.com',
    provider: 'ProtonMail Pro',
    notes: 'Updated notes',
  });
  assert.strictEqual(updatedEmail.data.address, 'alice_updated@example.com');
  assert.strictEqual(updatedEmail.data.provider, 'ProtonMail Pro');
  assert.strictEqual(updatedEmail.data.notes, 'Updated notes');
  const reReadEmail = native.cmdGetNode('email', emailNode.data.id);
  assert.strictEqual(reReadEmail.data.address, 'alice_updated@example.com');
  console.log('cmd_update_node: PASS');

  // 4. Update node position -> persists
  native.cmdUpdateNodePosition('email', emailNode.data.id, 555.5, 666.5);
  const emailAfterPos = native.cmdGetNode('email', emailNode.data.id);
  assert.strictEqual(emailAfterPos.data.position_x, 555.5);
  assert.strictEqual(emailAfterPos.data.position_y, 666.5);
  console.log('cmd_update_node_position: PASS');

  // 5. cmd_get_nodes
  const allEmails = native.cmdGetNodes('email');
  assert.strictEqual(allEmails.length, 1);
  assert.strictEqual(allEmails[0].data.id, emailNode.data.id);
  console.log('cmd_get_nodes: PASS');

  // 6. Create / Read / Update / Delete edge
  const edge = native.cmdCreateEdge({
    source_type: 'account',
    source_id: accountNode.data.id,
    target_type: 'service',
    target_id: serviceNode.data.id,
    relation: 'linked_account',
    notes: 'alice github link',
  });
  assert.ok(edge.id);
  assert.strictEqual(edge.source_type, 'account');
  assert.strictEqual(edge.source_id, accountNode.data.id);
  assert.strictEqual(edge.target_type, 'service');
  assert.strictEqual(edge.target_id, serviceNode.data.id);
  assert.strictEqual(edge.relation, 'linked_account');
  assert.strictEqual(edge.notes, 'alice github link');
  console.log('cmd_create_edge: PASS');

  const edges = native.cmdGetEdges();
  assert.strictEqual(edges.length, 1);
  assert.strictEqual(edges[0].id, edge.id);
  console.log('cmd_get_edges: PASS');

  const updatedEdge = native.cmdUpdateEdge(edge.id, {
    relation: 'recovery_for',
    notes: 'updated relation notes',
  });
  assert.strictEqual(updatedEdge.id, edge.id);
  assert.strictEqual(updatedEdge.relation, 'recovery_for');
  assert.strictEqual(updatedEdge.notes, 'updated relation notes');
  console.log('cmd_update_edge: PASS');

  // 7. cmd_get_graph & cmd_get_subgraph
  const graph = native.cmdGetGraph();
  assert.strictEqual(graph.nodes.length, 4);
  assert.strictEqual(graph.edges.length, 1);
  console.log('cmd_get_graph: PASS');

  const subgraph = native.cmdGetSubgraph('account', accountNode.data.id);
  assert.ok(Array.isArray(subgraph.edges));
  assert.strictEqual(subgraph.edges.length, 1);
  console.log('cmd_get_subgraph: PASS');

  // 8. Delete edge
  native.cmdDeleteEdge(edge.id);
  const edgesAfterDelete = native.cmdGetEdges();
  assert.strictEqual(edgesAfterDelete.length, 0);
  console.log('cmd_delete_edge: PASS');

  // 9. Cascade delete: recreate edge, delete connected node, verify edge also deleted
  const edgeForCascade = native.cmdCreateEdge({
    source_type: 'phone',
    source_id: phoneNode.data.id,
    target_type: 'account',
    target_id: accountNode.data.id,
    relation: 'recovery_for',
    notes: 'sms 2fa',
  });
  assert.strictEqual(native.cmdGetEdges().length, 1);
  // Delete phone node -> edge must be cascaded
  native.cmdDeleteNode('phone', phoneNode.data.id);
  // Verify node is deleted
  let phoneDeleted = false;
  try {
    native.cmdGetNode('phone', phoneNode.data.id);
  } catch (e) {
    phoneDeleted = true;
  }
  assert.strictEqual(phoneDeleted, true);
  // Verify connected edge is also deleted
  const edgesAfterCascade = native.cmdGetEdges();
  assert.strictEqual(edgesAfterCascade.length, 0);
  console.log('cmd_delete_node (with cascade edge delete): PASS');

  // 10. cmd_search finds created node by text field
  const searchResults = native.cmdSearch('alice_dev');
  assert.strictEqual(searchResults.length, 1);
  assert.strictEqual(searchResults[0].data.username, 'alice_dev');
  console.log('cmd_search: PASS');

  // 11. cmd_generate_password returns random string
  const pwdObj = native.cmdGeneratePassword();
  assert.ok(pwdObj && typeof pwdObj.password === 'string');
  assert.strictEqual(pwdObj.password.length, 24); // 12 bytes = 24 hex chars
  console.log('cmd_generate_password: PASS');

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log('=== ALL AUTOMATED ROUND-TRIP TESTS PASSED ===');
}

runTests().catch(err => {
  console.error('VERIFICATION FAILED:', err);
  process.exit(1);
});
