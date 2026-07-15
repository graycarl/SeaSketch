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
    `flowchart LR
    A([Start]) --> B{Is request valid?}

    subgraph MainFlow
      direction TB
      B -- Yes --> C[Process data]
      C --> D[(Database)]
      D --> E[Build response]
    end

    subgraph ErrorFlow
      direction TB
      B -- No --> X[Return 400]
      X -. log .-> L[Write error log]
    end

    E --> F((End))

    classDef error fill:#ffe6e6,stroke:#d33,stroke-width:2px;
    classDef ok fill:#e8fff0,stroke:#2b8a3e,stroke-width:2px;
    class X,L error
    class F ok`,
  ),

  sample(
    "sequence",
    "Sequence Diagram",
    `sequenceDiagram
    autonumber
    participant User
    participant Browser
    participant Server
    participant DB

    User->>Browser: Enter URL
    Browser->>+Server: GET /page
    Server->>+DB: SELECT data
    DB-->>-Server: rows
    Server-->>-Browser: HTML
    Browser-->>User: Render page

    alt Login required
        Note over Browser,Server: Session cookie required
        User->>Browser: Submit credentials
        Browser->>+Server: POST /login
        Server-->>-Browser: Set-Cookie
    else Already authenticated
        Browser->>Server: GET /page (with cookie)
        Server-->>Browser: 200 OK
    end

    par Metrics
        Browser->>Server: POST /metrics
    and Prefetch
        Browser->>Server: GET /api/recommendations
    end

    loop Every 30s
        Browser->>Server: Poll notifications
        Server-->>Browser: Notification list
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
        -String id
        +String name
        #List~Animal~ pets
        +adopt(Animal a) void
        +findPetNames() List~String~
    }

    class Repository~T~ {
        +save(T entity) void
        +findById(String id) T
    }

    Animal <|-- Dog : extends
    Animal <|-- Cat : extends
    Owner "1" o-- "0..*" Animal : owns
    Owner ..> Repository~Animal~ : uses`,
  ),

  sample(
    "state",
    "State Diagram",
    `stateDiagram-v2
    direction LR
    [*] --> Idle

    Idle --> Loading : fetch()

    state Loading {
        [*] --> Requesting
        Requesting --> Validating : response arrived
        Validating --> Parsing : schema ok
        Validating --> BadData : schema invalid
        Parsing --> [*]
    }

    Loading --> Decision : parsed
    Loading --> Error : timeout/network

    state Decision <<choice>>
    Decision --> Success : data ready
    Decision --> Error : business rule failed

    state Fork <<fork>>
    state Join <<join>>

    Success --> Fork : postProcess()
    Fork --> CacheWrite
    Fork --> Analytics
    CacheWrite --> Join
    Analytics --> Join
    Join --> Idle : ready for next request

    Error --> Idle : reset()
    Error --> Loading : retry()`,
  ),

  sample(
    "er",
    "Entity Relationship",
    `erDiagram
    CUSTOMER ||--o{ ORDER : places
    CUSTOMER ||--o{ INVOICE : "liable for"
    CUSTOMER }|..|{ DELIVERY_ADDRESS : uses
    ORDER ||--|{ ORDER_ITEM : contains
    PRODUCT ||--o{ ORDER_ITEM : "ordered in"
    PRODUCT_CATEGORY ||--|{ PRODUCT : contains
    INVOICE ||--|{ ORDER : covers

    CUSTOMER {
      int id PK
      string name
      string email
      datetime created_at
    }

    DELIVERY_ADDRESS {
      int id PK
      int customer_id FK
      string country
      string city
      string detail
      string postal_code
    }

    ORDER {
      int id PK
      int customer_id FK
      int delivery_address_id FK
      string status
      float total_amount
      datetime placed_at
    }

    INVOICE {
      int id PK
      int customer_id FK
      int order_id FK
      string invoice_no
      datetime issued_at
    }

    PRODUCT_CATEGORY {
      int id PK
      string name
      int parent_id FK
    }

    PRODUCT {
      int id PK
      int category_id FK
      string name
      float price
      int stock
    }

    ORDER_ITEM {
      int order_id PK, FK
      int product_id PK, FK
      int quantity
      float unit_price
    }`,
  ),

  sample(
    "gantt",
    "Gantt Chart",
    `gantt
    title SeaSketch Release Plan
    dateFormat YYYY-MM-DD
    axisFormat %m/%d
    tickInterval 1week
    excludes weekends

    section Planning
    Requirements            :done, req, 2026-04-01, 5d
    Architecture review     :done, arch, after req, 3d
    MVP freeze              :milestone, m1, after arch, 0d

    section Development
    Core state & storage    :crit, active, core, after m1, 8d
    Mermaid render optimize :crit, render, after core, 6d
    File tree UX            :ui, after core, 5d
    AI assistant integration:ai, after render, 4d

    section Testing
    Unit tests              :crit, test1, after render, 4d
    Integration tests       :crit, test2, after test1, 4d

    section Release
    Staging verification    :pre, after test2, 2d
    GA Release              :milestone, rel, after pre, 0d`,
  ),

  sample(
    "pie",
    "Pie Chart",
    `pie showData
    title Browser Market Share 2024
    "Chrome" : 65.4
    "Safari" : 18.7
    "Firefox" : 3.1
    "Edge" : 5.2
    "Others" : 7.6`,
  ),

  sample(
    "mindmap",
    "Mindmap",
    `mindmap
    root((SeaSketch))
        Diagrams((Diagrams))
            Flowchart
            Sequence
            Class
            State
        Features(Features)
            Syntax["**Syntax** highlighting"]
            LivePreview["Live preview (1s debounce)"]
            FileMgmt["File management"]
        Export[Export]
            PNG
            SVG
            PDF`,
  ),

  sample(
    "timeline",
    "Timeline",
    `timeline
    title History of Programming Languages
    section Early Foundations
      1957 : FORTRAN
      1959 : COBOL
      1972 : C
    section Modern OOP & Scripting
      1983 : C++
      1991 : Python
      1995 : Java : JavaScript : PHP
    section Modern Systems Era
      2009 : Go
      2014 : Swift : Rust`,
  ),

  sample(
    "gitgraph",
    "Git Graph",
    `gitGraph LR:
    commit id: "init"
    commit id: "docs" type: NORMAL

    branch develop
    checkout develop
    commit id: "feat: dashboard" type: HIGHLIGHT

    branch feature/login
    checkout feature/login
    commit id: "feat: login ui"
    commit id: "feat: auth middleware"

    checkout develop
    merge feature/login id: "merge-login" tag: "rc-1" type: REVERSE

    branch release/1.0
    checkout release/1.0
    commit id: "chore: release notes"

    checkout main
    merge release/1.0 id: "release-1.0" tag: "v1.0"
    commit id: "hotfix: patch-1" type: HIGHLIGHT

    checkout develop
    cherry-pick id: "hotfix: patch-1"`,
  ),

  sample(
    "journey",
    "User Journey",
    `journey
    title Team Workspace Onboarding Journey
    section Discovery
      Find website: 4: Visitor
      Read feature and pricing page: 3: Visitor
      Read use cases: 4: Visitor, Marketing
    section Signup
      Register with email: 5: Visitor
      Verify email link: 2: User, System
      Retry verification: 1: User, System, Support
      First login success: 5: User
    section First Value
      Import starter template: 4: User
      Create first Mermaid file: 5: User
      Invite teammate: 3: User, Teammate
      Finish first review: 4: User, Teammate`,
  ),

  sample(
    "quadrant",
    "Quadrant Chart",
    `%%{init: {"quadrantChart": {"chartWidth": 640, "chartHeight": 520}} }%%
    quadrantChart
    title Feature Prioritization Matrix
    x-axis Low Effort --> High Effort
    y-axis Low Impact --> High Impact
    quadrant-1 Do Later
    quadrant-2 Quick Wins
    quadrant-3 Fill-ins
    quadrant-4 Major Projects
    Dark Mode: [0.25, 0.85]
    Search: [0.45, 0.90]
    Export PDF: [0.60, 0.75]
    Offline Mode: [0.85, 0.80]
    Notifications: [0.30, 0.40]
    Analytics: [0.70, 0.55]
    Themes: [0.20, 0.30]
    AI Assistant: [0.68, 0.58]`,
  ),

  sample(
    "xychart",
    "XY Chart",
    `xychart-beta
    title "Monthly Revenue: Actual vs Target"
    x-axis [Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec]
    y-axis "Revenue ($K)" 0 --> 130
    bar [42, 55, 61, 73, 88, 95, 102, 98, 85, 79, 91, 110]
    line [45, 58, 64, 70, 82, 92, 100, 101, 90, 86, 96, 115]`,
  ),

  sample(
    "sankey",
    "Sankey Diagram",
    `sankey-beta
Renewable,Grid,320
Thermal,Grid,540
Grid,Industry,420
Grid,Transport,160
Grid,Buildings,180
Grid,Losses,100
Thermal,Losses,220
Gas,Industry,140
Oil,Transport,260
Solar,Renewable,90
Wind,Renewable,130
Hydro,Renewable,100`,
  ),

  sample(
    "block",
    "Block Diagram",
    `block-beta
    columns 4
    Client["Client"] space LB["Load Balancer"] space
    space space space space
    API1["API 1"] API2["API 2"] API3["API 3"] Cache[("Redis")]
    space space space space
    DB[("Primary DB")] space MQ["Message Queue"] Worker["Async Worker"]

    Client --> LB
    LB --> API1
    LB --> API2
    LB --> API3
    API1 --> DB
    API2 --> DB
    API3 --> DB
    API1 --> Cache
    API2 --> Cache
    API3 --> MQ
    MQ --> Worker
    Worker --> DB`,
  ),

  sample(
    "architecture",
    "Architecture Diagram",
    `architecture-beta
    group public(cloud)[Public Subnet]
    group private(cloud)[Private Subnet]

    service cdn(internet)[CDN] in public
    service lb(server)[Load Balancer] in public
    junction api_hub in private

    service api1(server)[API Server 1] in private
    service api2(server)[API Server 2] in private
    service db(database)[Primary DB] in private
    service cache(disk)[Redis Cache] in private

    cdn:R --> L:lb
    lb:R --> L:api_hub
    api_hub:R --> L:api1
    api_hub:R --> L:api2

    api1:R --> L:db
    api2:R --> L:db
    api1:B <--> T:cache
    api2:B <--> T:cache`,
  ),

  sample(
    "kanban",
    "Kanban",
    `---
config:
  kanban:
    ticketBaseUrl: 'https://example.atlassian.net/browse/#TICKET#'
---
kanban
  Todo
    id101[Write unit tests]@{ assigned: 'alice', priority: 'High', ticket: 'SEA-101' }
    id102[Update documentation]@{ assigned: 'bob', priority: 'Low', ticket: 'SEA-102' }

  [In progress]
    id103[Implement dark mode]@{ assigned: 'alice', priority: 'Very High', ticket: 'SEA-103' }

  Review
    id104[Refactor database layer]@{ assigned: 'carol', priority: 'High', ticket: 'SEA-104' }

  Done
    id105[Setup CI/CD pipeline]@{ assigned: 'dave', priority: 'Very Low' }

  [Can't reproduce]
    id106[Intermittent login flicker]@{ assigned: 'qa', ticket: 'SEA-106', priority: 'Low' }`,
  ),

  sample(
    "packet",
    "Packet Diagram",
    `packet-beta
    +16: "Source Port"
    +16: "Destination Port"
    +32: "Sequence Number"
    +32: "Acknowledgment Number"
    +4: "Data Offset"
    +6: "Reserved"
    106: "URG"
    107: "ACK"
    108: "PSH"
    109: "RST"
    110: "SYN"
    111: "FIN"
    112-127: "Window Size"
    +16: "Checksum"
    +16: "Urgent Pointer"
    +32: "Options"
    +64: "Data (variable length)"`,
  ),
];

export const samplesFolder: FolderNode = {
  id: SAMPLES_FOLDER_ID,
  name: "Samples",
  files: sampleFiles,
};
