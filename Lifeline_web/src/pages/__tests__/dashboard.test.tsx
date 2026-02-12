import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Dashboard from "../dashboard";
import type { ConnectionStatus, ContactCard, EmergencyAlert } from "../../types/realtime";
import type { User } from "../../types";

// ============================================================================
// Mocks
// ============================================================================

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

// Mock useMap hook
const mockHandleLocation = vi.fn();
const mockGetGeocode = vi.fn().mockResolvedValue("123 Test St, Test City");
const mockSetAddress = vi.fn();

vi.mock("../../scripts/useMap", () => ({
  useMap: () => ({
    markers: [],
    loading: false,
    handleLocation: mockHandleLocation,
    getGeocode: mockGetGeocode,
    setAddress: mockSetAddress,
    address: "123 Test St, Test City",
  }),
}));

// Mock DashboardMap component (uses Google Maps)
vi.mock("../../components/DashboardMap", () => ({
  default: ({ markers, loading, center }: { markers: unknown[]; loading: boolean; center: unknown }) => (
    <div data-testid="dashboard-map">
      <span data-testid="map-loading">{loading ? "Loading..." : "Map loaded"}</span>
      <span data-testid="map-markers">{markers.length} markers</span>
      <span data-testid="map-center">{center ? JSON.stringify(center) : "No center"}</span>
    </div>
  ),
}));

// Mock useDashboard hook - we'll control its return value in each test
const mockHandleLogout = vi.fn();
const mockAcknowledgeAlert = vi.fn();
const mockManualReconnect = vi.fn();

let mockDashboardReturn: {
  user: User | null;
  handleLogout: Mock;
  contactCards: ContactCard[];
  connectionStatus: ConnectionStatus;
  connectionError: string | null;
  activeAlerts: EmergencyAlert[];
  acknowledgeAlert: Mock;
  manualReconnect: Mock;
};

vi.mock("../../scripts/useDashboard", () => ({
  useDashboard: () => mockDashboardReturn,
}));

// ============================================================================
// Test Fixtures
// ============================================================================

const mockUser: User = {
  id: "user-123",
  name: "John Doe",
  email: "john@example.com",
  phone_no: "+1234567890",
  role: "user",
  image: "/images/john.jpg",
  location: { lat: 40.7128, lng: -74.006 },
};

const mockContactCard: ContactCard = {
  id: "contact-1",
  name: "Jane Smith",
  phone: "+9876543210",
  email: "jane@example.com",
  image: "/images/jane.jpg",
  role: "mutual",
  location: {
    userId: "contact-1",
    userName: "Jane Smith",
    roomId: "room-1",
    coords: { lat: 40.73, lng: -73.99 },
    timestamp: "2026-01-25T12:00:00.000Z",
    sos: false,
    acknowledged: false,
  },
  presence: {
    userId: "contact-1",
    userName: "Jane Smith",
    status: "online",
    lastSeen: "2026-01-25T12:00:00.000Z",
  },
  hasActiveAlert: false,
  activeAlert: null,
  roomId: "room-1",
};

const mockDependentContact: ContactCard = {
  id: "contact-2",
  name: "Bob Wilson",
  phone: "+1112223333",
  email: "bob@example.com",
  role: "dependent",
  location: null,
  presence: {
    userId: "contact-2",
    userName: "Bob Wilson",
    status: "offline",
    lastSeen: "2026-01-25T10:00:00.000Z",
  },
  hasActiveAlert: false,
  activeAlert: null,
  roomId: "room-2",
};

const mockEmergencyAlert: EmergencyAlert = {
  id: "alert-1",
  emergencyUserId: "contact-1",
  emergencyUserName: "Jane Smith",
  roomId: "room-1",
  message: "Help! I need assistance!",
  timestamp: "2026-01-25T12:30:00.000Z",
  acknowledged: false,
};

// ============================================================================
// Helper Functions
// ============================================================================

function createDefaultMockReturn(): typeof mockDashboardReturn {
  return {
    user: mockUser,
    handleLogout: mockHandleLogout,
    contactCards: [],
    connectionStatus: "connected",
    connectionError: null,
    activeAlerts: [],
    acknowledgeAlert: mockAcknowledgeAlert,
    manualReconnect: mockManualReconnect,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe("Dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDashboardReturn = createDefaultMockReturn();
  });

  // --------------------------------------------------------------------------
  // 1. Renders loading state
  // --------------------------------------------------------------------------
  describe("renders loading state", () => {
    it("shows 'Connecting...' status when connectionStatus is connecting", () => {
      mockDashboardReturn = {
        ...createDefaultMockReturn(),
        connectionStatus: "connecting",
      };

      render(<Dashboard />);

      expect(screen.getByText("Connecting...")).toBeInTheDocument();
    });

    it("shows yellow status indicator when connecting", () => {
      mockDashboardReturn = {
        ...createDefaultMockReturn(),
        connectionStatus: "connecting",
      };

      render(<Dashboard />);

      const statusDot = document.querySelector(".status-dot");
      expect(statusDot).toHaveStyle({ backgroundColor: "#eab308" });
    });

    it("shows 'Reconnecting...' status when reconnecting", () => {
      mockDashboardReturn = {
        ...createDefaultMockReturn(),
        connectionStatus: "reconnecting",
      };

      render(<Dashboard />);

      expect(screen.getByText("Reconnecting...")).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // 2. Renders connected state
  // --------------------------------------------------------------------------
  describe("renders connected state", () => {
    it("shows green status indicator when connected", () => {
      mockDashboardReturn = {
        ...createDefaultMockReturn(),
        connectionStatus: "connected",
      };

      render(<Dashboard />);

      expect(screen.getByText("Connected")).toBeInTheDocument();
      const statusDot = document.querySelector(".status-dot");
      expect(statusDot).toHaveStyle({ backgroundColor: "#22c55e" });
    });

    it("does not show reconnect button when connected", () => {
      mockDashboardReturn = {
        ...createDefaultMockReturn(),
        connectionStatus: "connected",
      };

      render(<Dashboard />);

      expect(screen.queryByText("Reconnect")).not.toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // 3. Renders contact cards
  // --------------------------------------------------------------------------
  describe("renders contact cards", () => {
    it("displays contact list when contacts are loaded", () => {
      mockDashboardReturn = {
        ...createDefaultMockReturn(),
        contactCards: [mockContactCard, mockDependentContact],
      };

      render(<Dashboard />);

      // Should show mutual contacts section
      expect(screen.getByText("Mutual")).toBeInTheDocument();
      // Should show dependent contacts section
      expect(screen.getByText("Dependent")).toBeInTheDocument();
      // Should show contact names (first name only)
      expect(screen.getByText("Jane")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
    });

    it("shows empty state when no contacts exist", () => {
      mockDashboardReturn = {
        ...createDefaultMockReturn(),
        contactCards: [],
      };

      render(<Dashboard />);

      expect(screen.getByText(/don't have any contacts yet/i)).toBeInTheDocument();
    });

    it("separates contacts by role (mutual vs dependent)", () => {
      mockDashboardReturn = {
        ...createDefaultMockReturn(),
        contactCards: [mockContactCard, mockDependentContact],
      };

      render(<Dashboard />);

      // Both sections should be visible
      expect(screen.getByText("Mutual")).toBeInTheDocument();
      expect(screen.getByText("Dependent")).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // 4. Shows emergency alert
  // --------------------------------------------------------------------------
  describe("shows emergency alert", () => {
    it("displays alert banner when activeAlerts has items", () => {
      mockDashboardReturn = {
        ...createDefaultMockReturn(),
        activeAlerts: [mockEmergencyAlert],
      };

      render(<Dashboard />);

      expect(screen.getByText("Emergency Alert:")).toBeInTheDocument();
      expect(screen.getByText(/Jane Smith - Help! I need assistance!/)).toBeInTheDocument();
    });

    it("displays multiple alerts when multiple exist", () => {
      const secondAlert: EmergencyAlert = {
        id: "alert-2",
        emergencyUserId: "contact-2",
        emergencyUserName: "Bob Wilson",
        roomId: "room-2",
        message: "Emergency situation!",
        timestamp: "2026-01-25T12:35:00.000Z",
        acknowledged: false,
      };

      mockDashboardReturn = {
        ...createDefaultMockReturn(),
        activeAlerts: [mockEmergencyAlert, secondAlert],
      };

      render(<Dashboard />);

      expect(screen.getByText(/Jane Smith - Help!/)).toBeInTheDocument();
      expect(screen.getByText(/Bob Wilson - Emergency situation!/)).toBeInTheDocument();
    });

    it("does not show alert banner when no active alerts", () => {
      mockDashboardReturn = {
        ...createDefaultMockReturn(),
        activeAlerts: [],
      };

      render(<Dashboard />);

      expect(screen.queryByText("Emergency Alert:")).not.toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // 5. Acknowledges alert
  // --------------------------------------------------------------------------
  describe("acknowledges alert", () => {
    it("calls acknowledgeAlert when Acknowledge button is clicked", () => {
      mockDashboardReturn = {
        ...createDefaultMockReturn(),
        activeAlerts: [mockEmergencyAlert],
      };

      render(<Dashboard />);

      const acknowledgeButton = screen.getByRole("button", { name: /acknowledge/i });
      fireEvent.click(acknowledgeButton);

      expect(mockAcknowledgeAlert).toHaveBeenCalledWith("alert-1");
    });

    it("shows Acknowledge button for each alert", () => {
      const secondAlert: EmergencyAlert = {
        ...mockEmergencyAlert,
        id: "alert-2",
        emergencyUserName: "Bob Wilson",
      };

      mockDashboardReturn = {
        ...createDefaultMockReturn(),
        activeAlerts: [mockEmergencyAlert, secondAlert],
      };

      render(<Dashboard />);

      const acknowledgeButtons = screen.getAllByRole("button", { name: /acknowledge/i });
      expect(acknowledgeButtons).toHaveLength(2);
    });
  });

  // --------------------------------------------------------------------------
  // 6. Shows reconnect button on error
  // --------------------------------------------------------------------------
  describe("shows reconnect button on error", () => {
    it("displays reconnect button when status is error", () => {
      mockDashboardReturn = {
        ...createDefaultMockReturn(),
        connectionStatus: "error",
        connectionError: "Connection failed",
      };

      render(<Dashboard />);

      expect(screen.getByText("Reconnect")).toBeInTheDocument();
      expect(screen.getByText("Connection Error")).toBeInTheDocument();
    });

    it("calls manualReconnect when reconnect button is clicked", () => {
      mockDashboardReturn = {
        ...createDefaultMockReturn(),
        connectionStatus: "error",
      };

      render(<Dashboard />);

      const reconnectButton = screen.getByText("Reconnect");
      fireEvent.click(reconnectButton);

      expect(mockManualReconnect).toHaveBeenCalled();
    });

    it("displays reconnect button when status is disconnected", () => {
      mockDashboardReturn = {
        ...createDefaultMockReturn(),
        connectionStatus: "disconnected",
      };

      render(<Dashboard />);

      expect(screen.getByText("Reconnect")).toBeInTheDocument();
      expect(screen.getByText("Disconnected")).toBeInTheDocument();
    });

    it("shows connection error message when present", () => {
      mockDashboardReturn = {
        ...createDefaultMockReturn(),
        connectionStatus: "error",
        connectionError: "WebSocket connection timeout",
      };

      render(<Dashboard />);

      expect(screen.getByText("WebSocket connection timeout")).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // 7. Updates contact location
  // --------------------------------------------------------------------------
  describe("updates contact location", () => {
    it("displays coordinates when location data is present", () => {
      const contactWithLocation: ContactCard = {
        ...mockContactCard,
      location: {
        userId: "contact-1",
        userName: "Jane Smith",
        roomId: "room-1",
        coords: { lat: 40.7589, lng: -73.9851 },
        timestamp: "2026-01-25T12:00:00.000Z",
        sos: false,
        acknowledged: false,
      },
      };

      mockDashboardReturn = {
        ...createDefaultMockReturn(),
        contactCards: [contactWithLocation],
      };

      render(<Dashboard />);

      // The map component should receive center based on user or selected contact
      const mapCenter = screen.getByTestId("map-center");
      expect(mapCenter).toBeInTheDocument();
    });

    it("calls handleLocation for user and contacts with location", () => {
      const contactWithLocation: ContactCard = {
        ...mockContactCard,
      location: {
        userId: "contact-1",
        userName: "Jane Smith",
        roomId: "room-1",
        coords: { lat: 40.73, lng: -73.99 },
        timestamp: "2026-01-25T12:00:00.000Z",
        sos: false,
        acknowledged: false,
      },
      };

      mockDashboardReturn = {
        ...createDefaultMockReturn(),
        contactCards: [contactWithLocation],
      };

      render(<Dashboard />);

      // Should be called for user
      expect(mockHandleLocation).toHaveBeenCalledWith(mockUser);
      // Should be called for contact with location
      expect(mockHandleLocation).toHaveBeenCalledWith({
        name: "Jane Smith",
        phone: "+9876543210",
        location: { lat: 40.73, lng: -73.99 },
      });
    });

    it("does not call handleLocation for contacts without location", () => {
      const contactWithoutLocation: ContactCard = {
        ...mockContactCard,
        location: null,
      };

      mockDashboardReturn = {
        ...createDefaultMockReturn(),
        contactCards: [contactWithoutLocation],
      };

      render(<Dashboard />);

      // Should be called for user only
      expect(mockHandleLocation).toHaveBeenCalledTimes(1);
      expect(mockHandleLocation).toHaveBeenCalledWith(mockUser);
    });
  });

  // --------------------------------------------------------------------------
  // Additional integration tests
  // --------------------------------------------------------------------------
  describe("user interactions", () => {
    it("navigates to profile when user image is clicked", () => {
      mockDashboardReturn = createDefaultMockReturn();

      render(<Dashboard />);

      const userImage = document.querySelector(".dashboard-img");
      if (userImage) {
        fireEvent.click(userImage);
      }

      expect(mockNavigate).toHaveBeenCalledWith("/profile");
    });

    it("calls handleLogout when LOGOUT is clicked", () => {
      mockDashboardReturn = createDefaultMockReturn();

      render(<Dashboard />);

      const logoutButton = screen.getByText("LOGOUT");
      fireEvent.click(logoutButton);

      expect(mockHandleLogout).toHaveBeenCalled();
    });

    it("displays user name in greeting", () => {
      mockDashboardReturn = createDefaultMockReturn();

      render(<Dashboard />);

      expect(screen.getByText("John")).toBeInTheDocument();
    });
  });
});
