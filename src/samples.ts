import { FolderNode, FileNode } from "./types";

export const SAMPLES_FOLDER_ID = "__samples__";

const sample = (id: string, name: string, content: string): FileNode => ({
  id: `__sample_${id}__`,
  name,
  content,
});

const sampleFiles: FileNode[] = [
  sample(
    "flowchart",
    "Flowchart",
    `flowchart TD
    A[Start] --> B{Is it working?}
    B -- Yes --> C[Great!]
    B -- No --> D[Debug]
    D --> E[Fix the issue]
    E --> B
    C --> F[Deploy]
    F --> G[End]`,
  ),

  sample(
    "sequence",
    "Sequence Diagram",
    `sequenceDiagram
    participant User
    participant Browser
    participant Server
    participant DB

    User->>Browser: Enter URL
    Browser->>Server: GET /page
    Server->>DB: SELECT data
    DB-->>Server: Return rows
    Server-->>Browser: HTML response
    Browser-->>User: Render page

    alt Login required
        User->>Browser: Submit credentials
        Browser->>Server: POST /login
        Server-->>Browser: Set cookie
    end`,
  ),

  sample(
    "class",
    "Class Diagram",
    `classDiagram
    class Animal {
        +String name
        +int age
        +makeSound() void
    }
    class Dog {
        +String breed
        +fetch() void
    }
    class Cat {
        +bool isIndoor
        +purr() void
    }
    class Owner {
        +String name
        +List~Animal~ pets
        +adopt(Animal a) void
    }

    Animal <|-- Dog : extends
    Animal <|-- Cat : extends
    Owner "1" o-- "many" Animal : owns`,
  ),

  sample(
    "state",
    "State Diagram",
    `stateDiagram-v2
    [*] --> Idle

    Idle --> Loading : fetch()
    Loading --> Success : data received
    Loading --> Error : request failed

    Success --> Idle : reset()
    Error --> Idle : reset()
    Error --> Loading : retry()

    Success --> [*] : done`,
  ),

  sample(
    "er",
    "Entity Relationship",
    `erDiagram
    USER {
        int id PK
        string name
        string email
        datetime created_at
    }
    ORDER {
        int id PK
        int user_id FK
        float total
        string status
        datetime placed_at
    }
    PRODUCT {
        int id PK
        string name
        float price
        int stock
    }
    ORDER_ITEM {
        int order_id FK
        int product_id FK
        int quantity
        float unit_price
    }

    USER ||--o{ ORDER : places
    ORDER ||--|{ ORDER_ITEM : contains
    PRODUCT ||--o{ ORDER_ITEM : "included in"`,
  ),

  sample(
    "gantt",
    "Gantt Chart",
    `gantt
    title Project Roadmap
    dateFormat  YYYY-MM-DD
    section Planning
        Requirements gathering   :done,    p1, 2024-01-01, 2024-01-07
        System design            :done,    p2, 2024-01-08, 2024-01-14
    section Development
        Backend API              :active,  d1, 2024-01-15, 2024-02-05
        Frontend UI              :         d2, 2024-01-22, 2024-02-10
        Database migration       :         d3, 2024-02-01, 2024-02-07
    section Testing
        Unit tests               :         t1, 2024-02-08, 2024-02-15
        Integration tests        :         t2, 2024-02-16, 2024-02-22
    section Release
        Deploy to staging        :         r1, 2024-02-23, 2024-02-25
        Production release       :         r2, 2024-02-26, 2024-02-28`,
  ),

  sample(
    "pie",
    "Pie Chart",
    `pie title Browser Market Share 2024
    "Chrome"    : 65.4
    "Safari"    : 18.7
    "Firefox"   : 3.1
    "Edge"      : 5.2
    "Others"    : 7.6`,
  ),

  sample(
    "mindmap",
    "Mindmap",
    `mindmap
    root((SeaSketch))
        Diagrams
            Flowchart
            Sequence
            Class
            State
        Features
            Syntax Highlighting
            Live Preview
            File Management
        Export
            PNG
            SVG
            PDF`,
  ),

  sample(
    "timeline",
    "Timeline",
    `timeline
    title History of Programming Languages
    1957 : FORTRAN
    1959 : COBOL
    1972 : C
    1983 : C++
    1991 : Python
    1995 : Java
         : JavaScript
         : PHP
    2009 : Go
    2014 : Swift
         : Rust`,
  ),

  sample(
    "gitgraph",
    "Git Graph",
    `gitGraph
    commit id: "Initial commit"
    commit id: "Add README"

    branch develop
    checkout develop
    commit id: "Feature A"
    commit id: "Feature B"

    branch feature/login
    checkout feature/login
    commit id: "Login form"
    commit id: "Auth middleware"
    checkout develop
    merge feature/login id: "Merge login"

    checkout main
    merge develop id: "Release v1.0" tag: "v1.0"
    commit id: "Hotfix"`,
  ),

  sample(
    "journey",
    "User Journey",
    `journey
    title User Onboarding Experience
    section Discovery
        Find website: 3: Visitor
        Read landing page: 4: Visitor
    section Sign Up
        Click register: 5: Visitor
        Fill in form: 3: User
        Verify email: 2: User
    section First Use
        Complete tutorial: 4: User
        Create first project: 5: User
        Invite teammates: 4: User`,
  ),

  sample(
    "quadrant",
    "Quadrant Chart",
    `quadrantChart
    title Product Feature Priority Matrix
    x-axis Low Effort --> High Effort
    y-axis Low Impact --> High Impact
    quadrant-1 Do Later
    quadrant-2 Quick Wins
    quadrant-3 Fill-ins
    quadrant-4 Major Projects
    Dark Mode: [0.25, 0.85]
    Search: [0.45, 0.9]
    Export PDF: [0.6, 0.75]
    Offline Mode: [0.85, 0.8]
    Notifications: [0.3, 0.4]
    Analytics: [0.7, 0.55]
    Themes: [0.2, 0.3]`,
  ),

  sample(
    "xychart",
    "XY Chart",
    `xychart-beta
    title "Monthly Revenue (USD)"
    x-axis [Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec]
    y-axis "Revenue ($K)" 0 --> 120
    bar  [42, 55, 61, 73, 88, 95, 102, 98, 85, 79, 91, 110]
    line [42, 55, 61, 73, 88, 95, 102, 98, 85, 79, 91, 110]`,
  ),

  sample(
    "sankey",
    "Sankey Diagram",
    `sankey-beta
Agricultural waste,Bio-conversion,124.7
Bio-conversion,Liquid,0.6
Bio-conversion,Losses,26.9
Bio-conversion,Solid,280.3
Bio-conversion,Gas,81.1
Coal imports,Coal,11.6
Coal reserves,Coal,63.9
Coal,Solid,75.6
Electricity grid,Industry,342.2
Electricity grid,Heating and cooling,113.7
Electricity grid,Road transport,37.8
Electricity grid,Losses,56.7
Gas imports,Ngas,40.7
Gas reserves,Ngas,82.2
Ngas,Gas,122.9
Nuclear,Thermal generation,840.0
Oil imports,Oil,504.3
Oil reserves,Oil,107.7
Oil,Liquid,611.9
Solar PV,Electricity grid,59.9
Thermal generation,Electricity grid,525.5
Thermal generation,Losses,787.1
Wind,Electricity grid,289.4`,
  ),

  sample(
    "block",
    "Block Diagram",
    `block-beta
    columns 3
    A["Client"] space B["Load Balancer"]
    space space space
    C["Server 1"] D["Server 2"] E["Server 3"]
    space space space
    F[("Database")] space G["Cache"]

    A --> B
    B --> C
    B --> D
    B --> E
    C --> F
    D --> F
    E --> F
    C --> G
    D --> G`,
  ),

  sample(
    "architecture",
    "Architecture Diagram",
    `architecture-beta
    group vpc(cloud)[VPC]

    service cdn(internet)[CDN] in vpc
    service lb(server)[Load Balancer] in vpc
    service api1(server)[API Server 1] in vpc
    service api2(server)[API Server 2] in vpc
    service db(database)[Primary DB] in vpc
    service cache(disk)[Redis Cache] in vpc

    cdn:R --> L:lb
    lb:R --> L:api1
    lb:R --> L:api2
    api1:R --> L:db
    api2:R --> L:db
    api1:B --> T:cache
    api2:B --> T:cache`,
  ),

  sample(
    "kanban",
    "Kanban",
    `kanban
    Todo
        [Write unit tests]
        [Update documentation]
        [Code review for PR #42]
    In Progress
        id1[Implement dark mode]@{ assigned: 'alice' }
        id2[Fix login bug]@{ assigned: 'bob', priority: 'High' }
    Review
        id3[Refactor database layer]@{ ticket: 'ISSUE-101' }
    Done
        id4[Setup CI/CD pipeline]
        id5[Design system components]`,
  ),

  sample(
    "packet",
    "Packet Diagram",
    `packet-beta
    0-15: "Source Port"
    16-31: "Destination Port"
    32-63: "Sequence Number"
    64-95: "Acknowledgment Number"
    96-99: "Data Offset"
    100-105: "Reserved"
    106: "URG"
    107: "ACK"
    108: "PSH"
    109: "RST"
    110: "SYN"
    111: "FIN"
    112-127: "Window Size"
    128-143: "Checksum"
    144-159: "Urgent Pointer"
    160-191: "Options"
    192-255: "Data"`,
  ),
];

export const samplesFolder: FolderNode = {
  id: SAMPLES_FOLDER_ID,
  name: "Samples",
  files: sampleFiles,
};
