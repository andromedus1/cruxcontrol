# Kilter Board Fullride 7x10 -- Technical Primer

## Table of Contents

1. [What is the Kilter Board?](#1-what-is-the-kilter-board)
2. [The Fullride 7x10 Model](#2-the-fullride-7x10-model)
3. [Communication Protocol (BLE)](#3-communication-protocol-ble)
4. [LED System and Hold Addressing](#4-led-system-and-hold-addressing)
5. [Angle Adjustment](#5-angle-adjustment)
6. [Official App and Its Limitations](#6-official-app-and-its-limitations)
7. [Community Tools and Libraries](#7-community-tools-and-libraries)
8. [Sources](#8-sources)

---

## 1. What is the Kilter Board?

The Kilter Board is a standardized climbing training wall with LED-illuminated holds, designed by Kilter Grips (co-owned by Ian Powell and Jackie Hueftle). It belongs to the **Aurora Climbing** family of smart training boards, which also includes the Tension Board, Decoy Board, Grasshopper Board, So iLL Board, and Touchstone Board. All Aurora boards share a common technology platform: the same BLE protocol, the same app architecture, and the same database schema.

The core concept: a wall with a grid of bolt-on holds, each backed by an individually addressable RGB LED. A companion smartphone app connects via Bluetooth Low Energy (BLE) to a controller behind the wall. When the climber selects a problem (route), the app sends LED commands to the controller, which illuminates the relevant holds in colors indicating their role (start, hand, foot-only, finish). The climber then attempts the problem.

The board has tens of thousands of community-created problems at every difficulty grade, and the angle of the wall can be adjusted to change difficulty.

---

## 2. The Fullride 7x10 Model

### Dimensions

| Attribute | Value |
|-----------|-------|
| Width | 7 feet (~2.13 m) |
| Height | 10 feet (~3.05 m) |
| Kickboard | None |
| Grid spacing | Standard 20 cm (~8 in) square grid |

The Fullride is the **highest-density** Kilter Board layout. It fills every t-nut hole in the standard 20 cm grid **and** the overlay grid, making it the densest board with the most options per square foot.

### Holds

| Component | Count | Description |
|-----------|-------|-------------|
| **Mainline Pack** | 165 bolt-on holds | More generous: crimps, edges, pinches, slopers, incut ears, mini-jugs. Fills every t-nut in the standard 20 cm grid. |
| **Auxiliary Pack** | 140 bolt-on holds | Thinner crimps, pinches, slopey-to-flat edges, some mini-jugs/incut ears. Fills the overlay grid holes. |
| **Screw-on footholds** | 60 | Small foot jibs screwed directly into the wall surface. |
| **Total bolt-on holds** | 305 | |
| **Total holds (incl. footholds)** | 365 | |

### LED System

| Attribute | Value |
|-----------|-------|
| LED count | 450 |
| LED type | Individually addressable RGB (likely WS2812B-compatible, 5V) |
| Addressing | Each LED has a unique integer position index, mapped to a hold via the `leds` database table |
| Color depth | 8-bit compressed RGB: 3 bits red, 3 bits green, 2 bits blue (256 colors) |

The LEDs are installed behind the holds, shining through or around each hold so climbers can see the color. The LED strip runs in a specific physical order behind the board; the position index in the protocol corresponds to the LED's sequential position in that strip, **not** its grid coordinate. The mapping from position index to physical hold is stored in the app's local SQLite database.

### Pricing

As of 2025, the Full Ride complete setup (Mainline + Auxiliary holds + LED kit) is approximately **$6,600 USD** from Setter Closet.

### Original vs. Fullride

| | Original Layout | Fullride Layout |
|---|---|---|
| Hold density | Standard | Much higher per sq ft |
| Grid coverage | Standard 20 cm grid only | Standard + overlay grid |
| Movement style | Varied terrain, dynamic | Precision, footwork, outdoor-style |
| App/LED compatibility | Same | Same |

Both layouts use identical LED technology and app functionality. The difference is purely in hold count, density, and climbing style.

---

## 3. Communication Protocol (BLE)

The Kilter Board uses **Bluetooth Low Energy (BLE)** exclusively for app-to-board communication. There is no WiFi. The protocol is shared across all Aurora Climbing boards.

### BLE Service Structure

| Layer | UUID | Purpose |
|-------|------|---------|
| **Advertisement Service** | `4488B571-7806-4DF6-BCFF-A2897E4953FF` | Device discovery -- the board advertises this UUID so the app can find it |
| **UART Service** | `6E400001-B5A3-F393-E0A9-E50E24DCCA9E` | Nordic UART Service (NUS) -- provides serial-like bidirectional communication |
| **RX Characteristic** (write) | `6E400002-B5A3-F393-E0A9-E50E24DCCA9E` | App writes LED commands to this characteristic |

The service UUIDs (`6E400001/2/3`) are the standard **Nordic UART Service (NUS)** UUIDs, which is a de facto standard for serial-over-BLE communication. The Kilter Board uses the NUS RX characteristic for receiving commands from the app.

### Board Naming Convention

The BLE device name follows this format:

```
[AlphanumericName][#SerialNumber][@APILevel]
```

Examples:
- `mykilterboard#2353@3` -- name "mykilterboard", serial 2353, API level 3
- `mykilterboard@2` -- API level 2
- `mykilterboard` -- defaults assumed

The app displays only the alphanumeric portion to the user. The serial number and API level are metadata parsed by the app to determine protocol behavior.

### Write Mechanics

- Data is written to the RX characteristic in chunks of **20 bytes** (standard BLE characteristic write size with default MTU).
- Messages that exceed 20 bytes are split across multiple writes.
- Messages are composed of one or more **packets** (max 260 bytes each).
- Multiple packets within a message are sent in FIFO order.

### Packet Frame Format

Every packet is wrapped in a frame:

```
[0x01] [length] [checksum] [0x02] [payload...] [0x03]
```

| Byte(s) | Value | Meaning |
|---------|-------|---------|
| 1 | `0x01` | Start-of-frame delimiter |
| 2 | `length` | Number of payload bytes |
| 3 | `checksum` | Checksum of all payload bytes |
| 4 | `0x02` | Start-of-payload delimiter |
| 5..N | payload | The actual command data |
| N+1 | `0x03` | End-of-frame delimiter |

### Checksum Calculation

```
checksum = (~(sum_of_all_payload_bytes & 0xFF)) & 0xFF
```

Sum all payload bytes into a single byte (overflows wrap), then bitwise invert.

### API Level 3 (Current Standard)

API level 3 is the modern protocol. The first byte of the payload indicates the packet's position within a multi-packet message:

| First Byte | Char | Meaning |
|------------|------|---------|
| `0x54` | T | Single packet (entire message fits in one packet) |
| `0x52` | R | First packet of a multi-packet sequence |
| `0x51` | Q | Middle packet |
| `0x53` | S | Last packet |

After the type byte, the payload contains **hold placements** encoded as 3 bytes each:

```
[position_low] [position_high] [color_byte]
```

| Byte | Bits | Content |
|------|------|---------|
| 1 | 7:0 | Lower 8 bits of 16-bit LED position |
| 2 | 7:0 | Upper 8 bits of 16-bit LED position |
| 3 | 7:5 = R, 4:2 = G, 1:0 = B | Compressed 8-bit RGB color |

This allows addressing up to **65,536 LED positions** and encoding **256 colors**.

Maximum payload per packet: 255 bytes. With 3 bytes per hold and 1 byte for the type marker, that is **(255 - 1) / 3 = ~84 holds** per packet.

### API Level 2 (Legacy)

Older boards may use API level 2, which has a different encoding:

| First Byte | Char | Meaning |
|------------|------|---------|
| `0x50` | P | Single packet |
| `0x4E` | N | First packet |
| `0x4D` | M | Middle packet |
| `0x4F` | O | Last packet |

Hold encoding uses **2 bytes per hold**:
- Byte 1: Lower 8 bits of 10-bit position
- Byte 2: Upper 2 bits of position (bits 1:0) + 6-bit color (2 bits per R/G/B channel)

This limits addressing to **1,024 positions** and **64 colors**.

### Complete Transmission Example

To light a single hold at position 42 in green (role: start hold):

1. Encode position: `low = 0x2A`, `high = 0x00`
2. Encode color green (#00FF00): R=0, G=7, B=0 -> `(0 << 5) | (7 << 2) | 0 = 0x1C`
3. Build payload: `[0x54, 0x2A, 0x00, 0x1C]` (single packet, one hold)
4. Calculate checksum: `(~(0x54 + 0x2A + 0x00 + 0x1C) & 0xFF) & 0xFF`
5. Frame: `[0x01, 0x04, checksum, 0x02, 0x54, 0x2A, 0x00, 0x1C, 0x03]`
6. Write to characteristic `6E400002-B5A3-F393-E0A9-E50E24DCCA9E` in 20-byte chunks

---

## 4. LED System and Hold Addressing

### Color Role System

The Kilter Board uses a **role-based color system** to indicate what each hold is for:

| Role | role_id | LED Color | Hex (approx.) | Meaning |
|------|---------|-----------|----------------|---------|
| **Start** | 12 | Green | `#00FF00` | Starting holds -- begin with both hands here |
| **Middle (hand+feet)** | 13 | Blue/Cyan | `#00FFFF` | Intermediate holds usable by hands and feet |
| **Finish** | 14 | Magenta/Purple | `#FF00FF` | Finish hold -- match both hands here to complete |
| **Foot-only** | 15 | Orange/Yellow | `#FFCF00` | Feet only -- hands may not use these holds |

The app also supports a **colorblind mode** that adjusts the color scheme for accessibility.

### How LEDs Map to Holds

The mapping chain from database to physical LED:

```
climb (route) -> frames string "p{placement_id}r{role_id}..."
    -> placements table: placement_id -> hole_id
        -> leds table: hole_id -> led_position (integer)
            -> BLE command: (led_position, color_for_role)
```

1. **`climbs` table**: Each route stores its hold configuration as a string like `p1083r15p1117r15p1164r12p1201r13p1248r14` where `p` prefixes a placement_id and `r` prefixes a role_id.
2. **`placements` table**: Maps `placement_id` to `hole_id` (a physical hole on the board).
3. **`leds` table**: Maps `hole_id` to the LED `position` integer used in the BLE protocol.
4. **`placement_roles` table**: Maps `role_id` to the LED color to display.
5. The app constructs an array of `(position, color)` pairs and sends them as a BLE packet.

### Color Compression Details

The 24-bit RGB to 8-bit conversion:

```python
def compress_color(r, g, b):
    """Convert 24-bit RGB to 8-bit Kilter format."""
    r3 = r >> 5       # 3 bits (0-7)
    g3 = g >> 5       # 3 bits (0-7)
    b2 = b >> 6       # 2 bits (0-3)
    return (r3 << 5) | (g3 << 2) | b2

def decompress_color(byte):
    """Convert 8-bit Kilter format back to 24-bit RGB (approximate)."""
    r = ((byte >> 5) & 0x07) * 32
    g = ((byte >> 2) & 0x07) * 32
    b = (byte & 0x03) * 64
    return (r, g, b)
```

Blue has lower resolution (2 bits / 4 levels) while red and green each get 3 bits (8 levels). This is a common trade-off based on human color perception.

---

## 5. Angle Adjustment

### Commercial Gym Boards

Full-size Kilter Boards in commercial gyms typically feature **motorized/hydraulic angle adjustment** systems. The wall can be tilted from nearly vertical (around 0-15 degrees overhang) to severely overhanging (up to 70 degrees).

### Home Wall (7x10 Fullride)

The 7x10 Fullride is designed for **home walls**. Angle adjustment depends on how you build or purchase the frame:

- **Manual adjustment**: Most home wall setups use a manual adjustment system (pin/bolt repositioning or a hand crank).
- **Third-party motorized frames**: Companies like Walltopia and OnSite sell adjustable angle frames compatible with Kilter Board layouts.
- **App angle setting**: Regardless of whether the physical angle adjustment is motorized or manual, the app allows you to **indicate what angle your wall is currently set at**. This is important because routes are designed and graded for specific angles.

The angle is **not** automatically detected by the board hardware. The user must set it in the app to match the physical wall angle.

### Angle Range

Typical angles range from **0 degrees** (vertical) to **70 degrees** (severely overhanging). Most routes are set between 15 and 50 degrees. The same hold layout at a steeper angle is significantly harder.

---

## 6. Official App and Its Limitations

The current official app is published by **Kilter Grips / MWM** and is available on iOS and Android. It replaced the original app in early 2025 after a contentious transition.

### Core Features

- Browse/search thousands of community-created boulder problems
- BLE connection to light up holds
- Create and publish your own routes
- Log ascents and view logbook history
- Playlists for session planning
- Filter by grade, angle, ascent status, quality
- Colorblind mode
- Board setup (size, layout, foothold config, angle)

### Major Limitations

1. **Performance**: 20-30+ second load times, laggy UI, crashes
2. **Poor Search/Discovery**: Finding previously attempted routes is unintuitive, no shareable links
3. **The App Transition Crisis (2025)**: Original app pulled abruptly; tens of thousands of climbers lost logbooks, ascent histories, project lists
4. **Missing Features**: Cannot log attempt without marking a send, no multi-user connection
5. **Ecosystem Lock-in**: No public API, no web interface, mobile-only, limited offline support

### Motivations for Building a Custom App

1. **Performance**: A well-built app can load instantly
2. **Shareable links**: Web app can generate URLs for specific problems
3. **Better search/filter**: Direct SQLite access enables powerful custom queries
4. **Data ownership**: Users maintain their own logbooks without platform risk
5. **Web Bluetooth API**: Enables a fully web-based app (no native install required)
6. **Custom features**: Mirror mode, auto circuit generation, training programs, AI route recommendations, analytics
7. **Multi-board support**: Single app for all Aurora boards

---

## 7. Community Tools and Libraries

### Key Open-Source Projects

| Project | URL | Description |
|---------|-----|-------------|
| **BoardLib** | github.com/lemeryfertitta/BoardLib | Python library for downloading/syncing the Aurora Climbing SQLite database. Supports Kilter, Tension, and other boards. |
| **fake_kilter_board** | github.com/1-max-1/fake_kilter_board | ESP32 program + desktop app that emulates a Kilter Board over BLE. Invaluable for dev/testing. |
| **hangtime-grip-connect** | stevie-ray.github.io/hangtime-grip-connect | JavaScript/TypeScript library for BLE communication with Aurora boards. |
| **hangtime-arduino-kilterboard** | github.com/Stevie-Ray/hangtime-arduino-kilterboard | Arduino-based Kilter Board simulator with ArduinoBLE + web app support. |

### Using BoardLib to Get the Database

```bash
pip install boardlib
boardlib database kilter kilter.db --username YOUR_USERNAME
```

This downloads the full SQLite database with all tables (holes, leds, placements, climbs, etc.) for offline analysis and app development.

---

## 8. Sources

- Setter Closet - Kilter Board Fullride Complete (settercloset.com)
- Setter Closet - Kilter Board Overview, Sizes, App, FAQ, LED Troubleshooting, Layout Comparison
- fake_kilter_board (GitHub - 1-max-1)
- bazun.me - Kilter Board Reverse Engineering
- Grip Connect - Kilter Board Documentation (stevie-ray.github.io)
- BoardLib (GitHub - lemeryfertitta)
- Tim's Kilterboard Web App (tim.wants.coffee)
- Gripped Magazine - How to Use a Kilter Board
- Climbing.com - Kilter Board App Disappeared
- Climbing Business Journal - New Kilter Board App
- Kilter Board Climbing Wall App Official (kilterboard.io)
