export const SAMPLE_KS13_CSV = `Cost Centre,Cost Centre Name,Profit Centre,Profit Centre Name,Responsible Person,Person ID
1001,Marketing UK,PC01,UK Operations,"Smith, J",U001
1002,Marketing US,PC02,US Operations,"Jones, A",U002
1003,Sales UK,PC01,UK Operations,"Smith, J",U001
1004,Sales US,PC02,US Operations,"Jones, A",U002
1005,Field Sales EMEA,PC01,UK Operations,"Smith, J",U001
2001,Engineering Core,PC03,Technology,"Brown, K",U003
2002,IT Support,PC03,Technology,"Brown, K",U003
2003,Data Platform,PC03,Technology,"Patel, R",U005
3001,HR,PC04,Corporate,"White, L",U004
3002,Legal,PC04,Corporate,"White, L",U004
3003,Facilities,PC04,Corporate,"White, L",U004
`;

export const SAMPLE_CURRENT_HIERARCHY = {
  id: 'root',
  type: 'manager',
  label: 'Organisation',
  children: [
    {
      id: 'm-coo',
      type: 'manager',
      label: 'COO',
      children: [
        {
          id: 'p-smith',
          type: 'person',
          label: 'Smith, J',
          personId: 'U001',
          children: [
            { id: 'cc-1001', type: 'costcentre', label: 'Marketing UK', costCentreCode: '1001', profitCentre: 'PC01', children: [] },
            { id: 'cc-1003', type: 'costcentre', label: 'Sales UK', costCentreCode: '1003', profitCentre: 'PC01', children: [] }
          ]
        },
        {
          id: 'p-jones',
          type: 'person',
          label: 'Jones, A',
          personId: 'U002',
          children: [
            { id: 'cc-1002', type: 'costcentre', label: 'Marketing US', costCentreCode: '1002', profitCentre: 'PC02', children: [] },
            { id: 'cc-1004', type: 'costcentre', label: 'Sales US', costCentreCode: '1004', profitCentre: 'PC02', children: [] }
          ]
        }
      ]
    },
    {
      id: 'm-cto',
      type: 'manager',
      label: 'CTO',
      children: [
        {
          id: 'p-brown',
          type: 'person',
          label: 'Brown, K',
          personId: 'U003',
          children: [
            { id: 'cc-2001', type: 'costcentre', label: 'Engineering Core', costCentreCode: '2001', profitCentre: 'PC03', children: [] },
            { id: 'cc-2002', type: 'costcentre', label: 'IT Support', costCentreCode: '2002', profitCentre: 'PC03', children: [] }
          ]
        }
      ]
    },
    {
      id: 'p-white',
      type: 'person',
      label: 'White, L',
      personId: 'U004',
      children: [
        { id: 'cc-3001', type: 'costcentre', label: 'HR', costCentreCode: '3001', profitCentre: 'PC04', children: [] },
        { id: 'cc-3002', type: 'costcentre', label: 'Legal', costCentreCode: '3002', profitCentre: 'PC04', children: [] }
      ]
    }
  ]
};

export const SAMPLE_PROPOSED_HIERARCHY = {
  id: 'root',
  type: 'manager',
  label: 'Organisation',
  children: [
    {
      id: 'm-cco',
      type: 'manager',
      label: 'CCO (Commercial)',
      children: [
        {
          id: 'p-smith',
          type: 'person',
          label: 'Smith, J',
          personId: 'U001',
          children: [
            { id: 'cc-1001', type: 'costcentre', label: 'Marketing UK', costCentreCode: '1001', profitCentre: 'PC01', children: [] },
            { id: 'cc-1003', type: 'costcentre', label: 'Sales UK', costCentreCode: '1003', profitCentre: 'PC01', children: [] }
          ]
        },
        {
          id: 'p-jones',
          type: 'person',
          label: 'Jones, A (US lead)',
          personId: 'U002',
          children: [
            { id: 'cc-1002', type: 'costcentre', label: 'Marketing US', costCentreCode: '1002', profitCentre: 'PC02', children: [] },
            { id: 'cc-1004', type: 'costcentre', label: 'Sales US', costCentreCode: '1004', profitCentre: 'PC02', children: [] }
          ]
        }
      ]
    },
    {
      id: 'm-cto',
      type: 'manager',
      label: 'CTO',
      children: [
        {
          id: 'p-brown',
          type: 'person',
          label: 'Brown, K',
          personId: 'U003',
          children: [
            { id: 'cc-2001', type: 'costcentre', label: 'Engineering Core', costCentreCode: '2001', profitCentre: 'PC03', children: [] }
          ]
        },
        {
          id: 'p-patel',
          type: 'person',
          label: 'Patel, R',
          personId: 'U005',
          children: []
        }
      ]
    },
    {
      id: 'p-white',
      type: 'person',
      label: 'White, L',
      personId: 'U004',
      children: [
        { id: 'cc-3001', type: 'costcentre', label: 'HR', costCentreCode: '3001', profitCentre: 'PC04', children: [] }
      ]
    }
  ]
};
