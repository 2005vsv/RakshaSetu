import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('react-leaflet', () => {
  const React = require('react');
  const Container = ({ children }) => React.createElement('div', null, children);
  return {
    MapContainer: Container,
    TileLayer: Container,
    Marker: Container,
    Popup: Container,
    Polygon: Container,
    Circle: Container,
    useMap: () => ({ setView: jest.fn() }),
  };
});

jest.mock('./services/api', () => {
  const client = { get: jest.fn().mockRejectedValue(new Error('Unauthenticated')), post: jest.fn(), put: jest.fn(), patch: jest.fn() };
  return {
    nodeApi: client,
    geoApi: client,
    clearApiToken: jest.fn(),
    clearAdminAuthToken: jest.fn(),
    endpointsGeo: {},
    endpointsNode: {},
    default: { nodeApi: client, geoApi: client, endpointsGeo: {}, endpointsNode: {} },
  };
});

test('redirects unauthenticated administrators to login', async () => {
  render(<App />);
  expect(await screen.findByText(/admin login/i)).toBeInTheDocument();
});
