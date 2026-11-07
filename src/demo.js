export const demoGraph = {
  root: 'SHIP-42', blockType: 'Blocks', requests: 8, capturedAt: '2026-10-28T10:00:00.000Z',
  nodes: [
    {key: 'SHIP-42', summary: 'Launch the self-serve billing portal', owner: 'Avery', status: 'In progress', dependencies: ['BILL-18', 'WEB-23', 'OPS-9']},
    {key: 'BILL-18', summary: 'Reconcile invoice totals', owner: 'Sam', status: 'In progress', dependencies: ['DATA-7']},
    {key: 'WEB-23', summary: 'Confirm accessible checkout', owner: 'Riley', status: 'To do', dependencies: ['DATA-7']},
    {key: 'DATA-7', summary: 'Publish tax rounding fixtures', owner: null, status: 'To do', dependencies: []},
    {key: 'OPS-9', summary: 'Approve rollback rehearsal', owner: 'Jo', status: 'To do', dependencies: ['OPS-10', 'ACCESS-4']},
    {key: 'OPS-10', summary: 'Finalize deployment checklist', owner: 'Jo', status: 'To do', dependencies: ['OPS-9']},
    {key: 'ACCESS-4', available: false, reason: 'unavailable', done: false, dependencies: []}
  ].map(n => n.available === false ? n : {...n, available: true, done: false, updated: '2026-10-27T09:00:00Z'})
};
