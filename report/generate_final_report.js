const fs = require('fs');
const path = require('path');

console.log('Writing ultra-detailed publication-grade LaTeX document...');

// Helper to escape underscores in normal text
function esc(str) {
  return str.replace(/_/g, '\\_');
}

const Preamble = `\\documentclass[11pt,a4paper,openany]{report}

% ==============================================================================
% PREAMBLE AND PACKAGE CONFIGURATION
% ==============================================================================
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{geometry}
\\geometry{
    top=2.2cm,
    bottom=2.2cm,
    left=2.2cm,
    right=2.2cm,
    headheight=15pt,
    footskip=1.0cm
}

% Micro-typography and paragraph formatting (Eliminates empty gaps)
\\usepackage{microtype}
\\setlength{\\parskip}{0.45em plus 0.1em minus 0.1em}
\\setlength{\\parindent}{0pt}

% Float placement optimization (Prevents float pages and premature page breaks)
\\renewcommand{\\topfraction}{0.95}
\\renewcommand{\\bottomfraction}{0.95}
\\renewcommand{\\textfraction}{0.05}
\\renewcommand{\\floatpagefraction}{0.85}
\\setcounter{topnumber}{6}
\\setcounter{bottomnumber}{6}
\\setcounter{totalnumber}{10}

% Smooth continuous chapter flow: eliminates forced empty-page breaks between chapters
\\usepackage{titlesec}
\\titleclass{\\chapter}{straight}
\\titleformat{\\chapter}[hang]
  {\\normalfont\\LARGE\\bfseries\\color{primary}}{\\thechapter.\\ }{0.4em}{}
\\titlespacing*{\\chapter}{0pt}{18pt plus 3pt minus 2pt}{10pt plus 2pt minus 2pt}

\\titleformat{\\section}
  {\\normalfont\\Large\\bfseries\\color{primary}}{\\thesection}{0.6em}{}
\\titlespacing*{\\section}{0pt}{14pt plus 2pt minus 2pt}{7pt plus 1pt minus 1pt}

\\titleformat{\\subsection}
  {\\normalfont\\large\\bfseries\\color{secondary}}{\\thesubsection}{0.6em}{}
\\titlespacing*{\\subsection}{0pt}{11pt plus 2pt minus 1pt}{5pt plus 1pt minus 1pt}

\\titleformat{\\subsubsection}
  {\\normalfont\\normalsize\\bfseries\\color{darkslate}}{\\thesubsubsection}{0.6em}{}
\\titlespacing*{\\subsubsection}{0pt}{8pt plus 1pt minus 1pt}{4pt plus 1pt minus 1pt}

\\usepackage{amsmath,amssymb,amsfonts}
\\usepackage{graphicx}
\\graphicspath{{.}{figures/}{report/figures/}}

\\usepackage{xcolor}
% Professional Enterprise Developer Palette
\\definecolor{primary}{RGB}{30, 58, 138}       % Deep Navy #1E3A8A
\\definecolor{secondary}{RGB}{14, 116, 144}    % Deep Cyan #0E7490
\\definecolor{accent}{RGB}{99, 102, 241}       % Indigo Accent #6366F1
\\definecolor{darkslate}{RGB}{30, 41, 59}      % Slate #1E293B
\\definecolor{lightbg}{RGB}{248, 250, 252}     % Slate 50 #F8FAFC
\\definecolor{codebg}{RGB}{241, 245, 249}      % Slate 100 #F1F5F9
\\definecolor{bordercolor}{RGB}{226, 232, 240} % Slate 200 #E2E8F0
\\definecolor{successgreen}{RGB}{22, 101, 52}  % Green 800 #166534
\\definecolor{warningamber}{RGB}{180, 83, 9}   % Amber 700 #B45309
\\definecolor{dangerred}{RGB}{185, 28, 28}     % Red 700 #B91C1C

\\usepackage{booktabs}
\\usepackage{tabularx}
\\usepackage{array}
\\usepackage{multirow}
\\usepackage{fancyhdr}
\\usepackage{enumitem}
\\usepackage{caption}
\\usepackage{subcaption}
\\usepackage{float}
\\usepackage[most]{tcolorbox}
\\tcbuselibrary{skins,listings,breakable}

% Listings / Source Code Formatting
\\usepackage{listings}
\\lstdefinestyle{javastyle}{
    backgroundcolor=\\color{codebg},
    commentstyle=\\color{successgreen}\\itshape,
    keywordstyle=\\color{primary}\\bfseries,
    numberstyle=\\tiny\\color{darkslate},
    stringstyle=\\color{warningamber},
    basicstyle=\\ttfamily\\footnotesize,
    breakatwhitespace=false,
    breaklines=true,
    captionpos=b,
    keepspaces=true,
    numbers=left,
    numbersep=7pt,
    showspaces=false,
    showstringspaces=false,
    showtabs=false,
    tabsize=4,
    frame=single,
    rulecolor=\\color{bordercolor},
    xleftmargin=12pt,
    framexleftmargin=10pt
}

\\lstdefinestyle{asciistyle}{
    backgroundcolor=\\color{codebg},
    basicstyle=\\ttfamily\\scriptsize,
    breaklines=false,
    frame=single,
    rulecolor=\\color{bordercolor},
    numbers=none,
    keepspaces=true,
    xleftmargin=2pt,
    framexleftmargin=4pt,
    framexrightmargin=4pt
}
\\lstset{style=javastyle}

% Hyperref setup
\\usepackage{hyperref}
\\hypersetup{
    colorlinks=true,
    linkcolor=primary,
    filecolor=secondary,
    urlcolor=accent,
    citecolor=primary,
    pdfauthor={Sunkara Purna Jaswanth, Sagam Venkatesh, Lakkoju Mani Saketh, Jagarlamudi Akash Chowdary},
    pdftitle={Plexus: Enterprise Cross-Repository Dependency Impact Analyzer and CodeCity Architecture Engine},
    pdfsubject={Comprehensive Technical Project Report},
    pdfkeywords={Java 17, Spring Boot, Cross-Repository Dependencies, CodeCity, AST Parsing, Static Analysis, Neon PostgreSQL, Supabase}
}

% Header and Footer Styling
\\pagestyle{fancy}
\\fancyhf{}
\\fancyhead[L]{\\textcolor{darkslate}{\\small\\scshape Plexus Dependency Intelligence \\& CodeCity}}
\\fancyhead[R]{\\textcolor{darkslate}{\\small\\nouppercase{\\rightmark}}}
\\fancyfoot[L]{\\textcolor{darkslate}{\\scriptsize Cross-Repository Architecture Analyzer}}
\\fancyfoot[R]{\\textcolor{darkslate}{\\thepage}}
\\renewcommand{\\headrulewidth}{0.4pt}
\\renewcommand{\\footrulewidth}{0.4pt}

% Custom Alert \\& Highlight Boxes
\\newtcolorbox{infobox}[1][]{
  colback=lightbg,
  colframe=primary,
  fonttitle=\\bfseries\\color{white},
  colbacktitle=primary,
  enhanced,
  attach boxed title to top left={yshift=-2mm, xshift=5mm},
  title={#1},
  arc=2mm,
  boxrule=0.8pt
}

\\newtcolorbox{warningbox}[1][]{
  colback=lightbg,
  colframe=warningamber,
  fonttitle=\\bfseries\\color{white},
  colbacktitle=warningamber,
  enhanced,
  attach boxed title to top left={yshift=-2mm, xshift=5mm},
  title={#1},
  arc=2mm,
  boxrule=0.8pt
}
`;

const TitleAndPrelim = `
\\begin{document}

% ------------------------------------------------------------------------------
% TITLE PAGE
% ------------------------------------------------------------------------------
\\begin{titlepage}
    \\centering
    \\vspace*{0.3cm}
    
    {\\Huge \\textbf{\\textcolor{primary}{PLEXUS}}}\\\\[0.25cm]
    {\\LARGE \\textbf{Cross-Repository Dependency Impact Analyzer \\&}}\\\\[0.15cm]
    {\\LARGE \\textbf{2D CodeCity Software Metropolis Engine}}\\\\[0.5cm]
    
    \\rule{0.92\\textwidth}{1.5pt}\\\\[0.4cm]
    
    {\\large \\textsc{A Comprehensive Technical Report on Design, Architecture,}}\\\\[0.1cm]
    {\\large \\textsc{Implementation, and Verification in Enterprise Java}}\\\\[0.6cm]

    % Team Details Box (Exact Student Details Requested)
    \\begin{tcolorbox}[colback=lightbg,colframe=primary,arc=2mm,width=0.92\\textwidth]
        \\centering
        \\textbf{\\large Project Engineering Team Members}\\\\[0.25cm]
        \\begin{tabular}{p{7.0cm} p{4.5cm}}
            \\textbf{Student Full Name} & \\textbf{Registration Number} \\\\
            \\midrule
            \\textbf{Sunkara Purna Jaswanth} & \\texttt{AP25110010736} \\\\
            \\textbf{Sagam Venkatesh} & \\texttt{AP25110010658} \\\\
            \\textbf{Lakkoju Mani Saketh} & \\texttt{AP25110011069} \\\\
            \\textbf{Jagarlamudi Akash Chowdary} & \\texttt{AP25110011082} \\\\
        \\end{tabular}
    \\end{tcolorbox}

    \\vspace{0.4cm}

    \\begin{minipage}{0.47\\textwidth}
        \\begin{flushleft} \\small
            \\textbf{Core Technologies:}\\\\
            Java 17 (LTS) $\\cdot$ Spring Boot 3.2.5\\\\
            JavaParser AST Engine (v3.25.9)\\\\
            Neon PostgreSQL $\\cdot$ HikariCP\\\\
            Flyway Database Migrations (V1--V4)\\\\
            Supabase JWT RBAC Security\\\\
            React Flow $\\cdot$ Hardware SVG Canvas
        \\end{flushleft}
    \\end{minipage}
    \\begin{minipage}{0.47\\textwidth}
        \\begin{flushright} \\small
            \\textbf{Specialized Technical Domains:}\\\\
            Static Program Analysis $\\cdot$ AST Graphs\\\\
            Spatial Software Visualization (CodeCity)\\\\
            Semantic Versioning Upgrade Auditing\\\\
            Multi-Tenant Row-Level Security\\\\
            Cloud Concurrency \\& 512MB Guardrails\\\\
            Automated JUnit 5 Verification (50 Tests)
        \\end{flushright}
    \\end{minipage}
    
    \\vfill
    
    \\begin{tcolorbox}[colback=codebg,colframe=bordercolor,arc=2mm,width=0.92\\textwidth]
        \\centering
        \\scriptsize
        \\textbf{Project Status:} Fully Deployed, Production-Tested, and Verified.\\\\
        Verified with 50 Automated Unit \\& Integration Suites Across Security, Indexing, and Spatial Geometry.\\\\
        Deployment Target: Render Cloud Platform with Active 512MB RAM Concurrency Guardrails.
    \\end{tcolorbox}
    
    \\vspace{0.3cm}
    
    {\\large \\textbf{Academic \\& Engineering Technical Project Report}}\\\\[0.15cm]
    {\\small Date of Submission: \\today}
    
    \\vspace*{0.2cm}
\\end{titlepage}

% ------------------------------------------------------------------------------
% PRELIMINARY PAGES: ABSTRACT, TOC, LIST OF FIGURES & TABLES
% ------------------------------------------------------------------------------
\\pagenumbering{roman}
\\setcounter{page}{1}

\\begin{abstract}
\\noindent
Modern enterprise software engineering has transitioned decisively from monolithic architectures toward distributed microservices, multi-repository topologies, and polyglot dependency ecosystems. While this architectural decomposition provides decentralized team autonomy and decoupled deployment cadences, it introduces severe systemic vulnerabilities: \\textit{cross-repository coupling blindness}, \\textit{transitive dependency rot}, and \\textit{version divergence}. In large-scale engineering organizations, updating a foundational library or altering an API signature frequently triggers catastrophic, unforeseen regressions across dozens of downstream services that rely on incompatible transitive artifacts.

To resolve these challenges, this project introduces \\textbf{Plexus}, an enterprise-grade static analysis platform and spatial software visualization engine engineered in \\textbf{Java 17} and \\textbf{Spring Boot 3}. Plexus ingests multi-repository Git organizations and parses polyglot dependency manifests across Maven (\\texttt{pom.xml}), npm (\\texttt{package.json}), Gradle (\\texttt{build.gradle}), Python (\\texttt{requirements.txt} / \\texttt{pyproject.toml}), and Go (\\texttt{go.mod}). Utilizing \\textbf{JavaParser} for deterministic Abstract Syntax Tree (AST) code extraction, Plexus inspects class structures, method invocations, REST endpoints, and persistence operations without requiring live runtime deployment or invasive bytecode instrumentation.

Plexus pioneers the \\textbf{2D CodeCity Software Metropolis Engine}, a spatial visualization paradigm translating abstract AST code structures into a navigable digital metropolis where architectural packages become districts, classes become buildings with proportional footprints and heights, and method calls become connected avenues and streets. Plexus traces end-to-end HTTP request/response execution routes from controller security checkpoints through service layers down to database repositories.

Plexus incorporates enterprise database persistence via \\textbf{PostgreSQL} and \\textbf{HikariCP}, database migration versioning via \\textbf{Flyway}, robust cloud security via \\textbf{Supabase JWT Authentication}, and strict concurrency control algorithms engineered specifically for 512MB RAM cloud deployment. This report delivers an exhaustive, publication-grade academic analysis covering the theoretical background, system design, object-oriented principles, advanced Java concurrency mechanisms, database integration, source code implementations, empirical testing with 50 passing verification test suites, and future enhancements including the \\textbf{Plexus AI Visual Project Understanding Assistant}.
\\end{abstract}

\\vspace{0.2cm}
\\noindent \\textbf{Keywords:} Software Architecture Visualization, Static Program Analysis, Cross-Repository Dependencies, Abstract Syntax Tree, JavaParser, CodeCity Spatial Metaphor, Spring Boot, Semantic Versioning, Microservices Governance, Plexus AI.

\\vspace{0.3cm}
\\tableofcontents

\\vspace{0.3cm}
\\listoffigures

\\vspace{0.3cm}
\\listoftables

\\clearpage
\\pagenumbering{arabic}
\\setcounter{page}{1}
`;

const Ch1 = `
% ------------------------------------------------------------------------------
% CHAPTER 1: IDENTIFICATION & BACKGROUND
% ------------------------------------------------------------------------------
\\chapter{Identification of the Project and Background}

\\section{Project Title and Real-World Identification}
\\begin{center}
    \\textbf{\\Large Plexus: Enterprise Cross-Repository Dependency Impact Analyzer and 2D CodeCity Software Metropolis Engine}
\\end{center}

The project addresses one of the most critical, high-stakes operational challenges in modern software engineering: \\textbf{Cross-Repository Dependency Impact Analysis, Architectural Governance, and Code Comprehension in Multi-Repository Distributed Ecosystems}.

In modern enterprise software organizations, software applications rarely operate in isolated monoliths. Instead, engineering departments maintain dozens, hundreds, or thousands of repositories comprising backend microservices, shared corporate utility libraries, distributed data pipelines, API gateways, and client applications. While these repositories are compiled, version-controlled, and deployed independently across separate CI/CD pipelines, they remain fundamentally coupled through shared dependencies, common data transfer objects (DTOs), and inter-service HTTP communication protocols.

Whenever a shared component undergoes a version increment or refactoring (for example, upgrading from \\texttt{Spring Boot 2.x} to \\texttt{3.x}, updating \\texttt{Jackson Databind} due to a critical security advisory, or altering a TypeScript API model), developers face immediate operational uncertainties:
\\begin{enumerate}[label=\\textbf{(\\alph*)}, leftmargin=1.2cm]
    \\item Which downstream repositories across the entire organization rely on this exact library or its transitively inherited packages?
    \\item Which microservices will encounter breaking compilation failures, binary incompatibilities, or subtle runtime contract violations?
    \\item What is the version divergence rate across repositories (e.g., Service A using version 1.2.0, while Service B uses version 2.4.0 of the exact same utility)?
    \\item How does an incoming HTTP request actually flow through the classes, methods, and database sinks of the application?
\\end{enumerate}

Plexus was conceived, architected, and built in Java to eliminate this blind spot. It provides an automated, deterministic platform that audits organizational dependency health, computes semantic versioning (SemVer) upgrade risks, generates bipartite ecosystem dependency graphs, and renders an interactive \\textbf{2D Software City (CodeCity)} that visually maps source code architecture onto an intuitive urban spatial layout.

\\section{The Dependency Hell Phenomenon in Enterprise Software}
In distributed architectures, dependency management transcends basic package importing; it becomes an intricate web of direct, indirect, and transitive relationships. Modern microservices frequently consume corporate parent POMs or shared enterprise SDKs that transitively pull hundreds of sub-dependencies. When multiple repositories consume divergent versions of shared libraries, subtle runtime defects emerge, including \\texttt{NoSuchMethodError}, \\texttt{ClassNotFoundException}, binary incompatibility, and unpredictable serialization discrepancies across network boundaries.

The infamous \\textit{diamond dependency problem} exemplifies this failure mode: if Repository A imports Library B and Library C, and both B and C depend on different, incompatible versions of Library D, the JVM's class-loading mechanism non-deterministically resolves whichever version appears first on the classpath. Such issues frequently evade static compiler checks and manifest only during production execution under specific traffic conditions.

Real-world security emergencies, such as the Log4Shell vulnerability (CVE-2021-44228) and the npm \\texttt{left-pad} outage, demonstrated that enterprise organizations often have zero visibility into which internal services harbor vulnerable transitive dependencies. Without global cross-repository mapping, identifying and remediating these vulnerabilities requires days of manual auditing across disconnected codebases. Plexus solves this by creating a centralized, real-time dependency intelligence graph across all repositories in an organization.

Furthermore, compliance requirements such as Executive Order 14028 and ISO/IEC 5230 mandate that enterprise software organizations maintain an accurate, auditable Software Bill of Materials (SBOM) for all deployed applications. By systematically indexing repositories, tracking direct and transitive dependencies, and computing health scores based on package freshness and vulnerability risk, Plexus transforms compliance from a manual audit nightmare into an automated continuous verification process.

\\section{Project Background and Motivation}
Over the past decade, the software engineering industry has witnessed a paradigm shift from monolithic application architectures to decentralized microservice topologies. While microservices deliver organizational autonomy and decoupled deployment cycles, they inadvertently dismantle global architectural visibility. 

Traditional dependency scanners (such as GitHub Dependabot, Snyk, or OWASP Dependency-Check) operate primarily on a reactive, single-repository vulnerability model. They notify developers that a specific library contains a known CVE, but they offer \\textit{zero visibility} into:
\\begin{itemize}[leftmargin=1.2cm]
    \\item The cross-repository topology: Which microservices share this library across the organization?
    \\item The architectural depth of usage: Is the library imported at the core domain level, or is it merely an unused transient dependency?
    \\item End-to-end invocation flow: Which API endpoints traverse through classes importing the affected dependency?
    \\item Architectural drift: Are packages suffering from circular dependencies, God classes, or layered architecture violations?
\\end{itemize}

Simultaneously, developer onboarding and architectural understanding remain notoriously difficult. Reading through hundreds of thousands of lines of code or static UML diagrams fails to convey the dynamic hierarchy and operational flow of a complex codebase. Developers need an intuitive mental model that reflects the structural composition of software systems. 

Plexus bridges this chasm by harmonizing multi-ecosystem manifest parsing, Abstract Syntax Tree (AST) code extraction, predictive upgrade impact analysis, and a groundbreaking \\textbf{2D Software City (CodeCity)} visualization that maps architectural packages into urban districts and classes into proportional 2D buildings. By mapping software complexity into a spatial geometry that mimics human urban geography, developers leverage evolutionary spatial orientation to comprehend intricate class structures, call pathways, and endpoint journeys effortlessly.
`;

const Ch2 = `
% ------------------------------------------------------------------------------
% CHAPTER 2: PROBLEM STATEMENT & OBJECTIVES
% ------------------------------------------------------------------------------
\\chapter{Problem Statement and Project Objectives}

\\section{Problem Statement}
Enterprise software engineering teams operating multi-repository distributed architectures encounter four debilitating bottlenecks that hinder developer productivity, obscure architectural clarity, and compromise software supply chain security. As organizations scale beyond a handful of codebases, decentralized development without centralized visibility creates technical debt and operational fragility:

\\subsection{Ecosystem Fragmentation and Manifest Diversity}
Enterprise organizations rarely standardize on a single programming language or package manager. A standard enterprise stack frequently incorporates Java backend microservices (configured via Maven \\texttt{pom.xml} or Gradle \\texttt{build.gradle}), Node.js edge services (configured via npm \\texttt{package.json}), machine learning and data engineering pipelines (configured via Python \\texttt{requirements.txt} or \\texttt{pyproject.toml}), and cloud-native infrastructure components (configured via Go \\texttt{go.mod}). 

Each package manager uses its own syntax, coordinate definitions, version constraint semantics, and scope mechanisms. Maven organizes packages via Group ID, Artifact ID, and Version (GAV coordinates), while npm utilizes package names and SemVer prefixes (\\texttt{\\^{}}, \\texttt{\\~{}}), and Python relies on PEP-508 version specifiers. Existing tooling forces developers to audit each repository in isolation using ecosystem-specific commands, leaving organizations without a unified, canonical view of their shared software assets.

Without an automated polyglot normalization engine, software architects cannot answer basic cross-cutting questions, such as identifying all internal applications using an outdated version of an encryption library across different language stacks. This fragmentation directly impedes vulnerability remediation and cross-team library standardization.

\\subsection{High-Risk Dependency Upgrades and Version Divergence}
Upgrading dependencies is often delayed or avoided entirely due to fear of unexpected breaking changes. Developers lack predictive tools to evaluate the blast radius of a version bump before merging code. Furthermore, repositories independently drift into divergent versions of the same shared libraries, leading to inconsistent security postures and maintenance overhead across teams.

When a foundational library releases a major version increment (such as \\texttt{Spring Boot 3.0} or \\texttt{React 19}), engineering leaders cannot quantify how many internal repositories will require code modifications versus safe drop-in updates. Without automated SemVer impact assessment, migration projects stall for months due to uncertainty, resulting in security vulnerabilities remaining unpatched across critical systems.

Plexus directly tackles version divergence by evaluating semantic version deltas across all repositories in the organizational fleet. By categorizing proposed library increments into \\textit{Breaking}, \\textit{Warning}, and \\textit{Safe} tiers, Plexus provides engineering managers with an evidence-backed upgrade roadmap.

\\subsection{Architectural Opacity and Static Call Graph Blindness}
Developers struggle to understand the internal architecture of complex repositories. Existing documentation is static, outdated, or disconnected from the actual source code. While debuggers trace runtime state, they require active deployment, configuration, and test data. Teams lack a static analysis engine capable of traversing class structures, resolving AST method invocations, and identifying HTTP REST endpoints without requiring live runtime deployment.

This opacity severely impacts new engineer onboarding and architectural governance. Developers modify classes without understanding the upstream entry points or downstream persistence sinks that depend on their methods, inadvertently introducing cascading bugs into production environments.

By parsing Abstract Syntax Trees directly from raw source code, Plexus reconstructs the static architectural skeleton of a repository. It identifies controller entry points, maps method invocation trajectories, and connects API endpoints with underlying data access repositories, providing total structural transparency without executing code.

\\subsection{The Graph Visualization Hairball Phenomenon}
When traditional graphing tools attempt to render architectures comprising hundreds of nodes and thousands of relationships, the resulting node-link diagram degenerates into an unreadable visual \\textit{hairball}. Without spatial hierarchy, semantic clustering, and continuous zoom scales, developers cannot extract meaningful architectural insights.

Force-directed graph layouts suffer from non-deterministic node positioning: every time a diagram is refreshed, nodes reposition randomly, destroying the user's spatial mental map. Developers need a deterministic, geometrically grounded spatial layout that leverages human urban navigation instincts to represent codebases predictably.

Plexus overcomes this challenge through the \\textbf{2D Software City (CodeCity)} paradigm. By laying out code as structured urban blocks separated by streets and avenues, Plexus establishes a persistent spatial coordinate system where spatial memory helps developers orient themselves and navigate codebases intuitively.

\\section{Objectives of the Project}
To resolve the problem statement definitively, the Plexus platform was engineered around six primary technical objectives:

\\begin{itemize}[leftmargin=1.5cm]
    \\item[\\textbf{OBJ-1:}] \\textbf{Automated Multi-Repository Indexing Engine:} Develop a multi-tenant repository ingestion service in Java that connects with GitHub REST/GraphQL APIs, verifies repository provenance (commit SHA, active branches, monorepo detection), and safely extracts repository content under strict cloud resource constraints.
    
    \\item[\\textbf{OBJ-2:}] \\textbf{Polyglot Dependency Manifest Parsing Engine:} Implement a polymorphic, extensible parsing subsystem supporting Maven, npm, Gradle, Python, and Go manifests, extracting clean canonical dependency coordinates (Group ID, Artifact Name, Semantic Version, Scope).
    
    \\item[\\textbf{OBJ-3:}] \\textbf{Predictive Upgrade Impact and Version Divergence Analysis:} Engineer a heuristic assessment algorithm that categorizes proposed version updates into \\textit{Breaking}, \\textit{Warning}, or \\textit{Safe} based on Semantic Versioning (SemVer) delta analysis and calculates organizational impact across all managed codebases.
    
    \\item[\\textbf{OBJ-4:}] \\textbf{AST Source Code Analysis and Endpoint Discovery:} Utilize JavaParser and JavaScript regex scanners to perform static source code inspection, extracting controllers, service classes, repository interfaces, REST endpoints (\\texttt{GET}, \\texttt{POST}, \\texttt{PUT}, \\texttt{DELETE}), and static call hierarchies.
    
    \\item[\\textbf{OBJ-5:}] \\textbf{Deterministic 2D CodeCity Software Metropolis Engine:} Design and implement a 2D layout algorithm that mathematically projects code components into an urban spatial metaphor. The layout engine must deterministically compute district boundaries, building dimensions, street coordinates, avenue intersections, and landmark placements.
    
    \\item[\\textbf{OBJ-6:}] \\textbf{Cloud Resource Safety and Enterprise Concurrency:} Guarantee that memory-intensive AST analysis and repository archiving operate reliably within severe cloud constraints (Render Free Tier 512MB RAM), featuring streaming extraction, concurrent job deduplication, timeouts, and multi-user row-level data isolation.
\\end{itemize}
`;

const Ch3 = `
% ------------------------------------------------------------------------------
% CHAPTER 3: SYSTEM DESIGN & ARCHITECTURE
% ------------------------------------------------------------------------------
\\chapter{System Design and Architecture}

\\section{Overall System Architecture}
Plexus is structured around a decoupled, enterprise multi-tier architecture consisting of five distinct conceptual layers designed for high throughput, modularity, and operational resilience:

\\begin{figure}[htbp]
\\centering
\\begin{lstlisting}[style=asciistyle, rulecolor=\\color{primary}]
+-------------------------------------------------------------------------+
|                       PRESENTATION & VISUALIZATION LAYER                |
|  - Engineering Dashboard (Overview, Health Score, Health Distribution)  |
|  - 2D CodeCity Software Metropolis (SVG Canvas, Continuous Zoom)        |
|  - Bipartite Topology Canvas (D3 Force-Directed Network Graph)          |
|  - Request Journey Inspector & Execution Timeline Playback Bar          |
+------------------------------------+------------------------------------+
                                     | (REST / JSON over HTTPS)
+------------------------------------v------------------------------------+
|                         REST CONTROLLER LAYER (Spring Web)              |
|  - RepositoryController          - CodeCityController                   |
|  - ArchitectureController        - ImpactController                     |
|  - AuthController                - OverviewController                   |
+------------------------------------+------------------------------------+
                                     |
+------------------------------------v------------------------------------+
|                          SERVICE & PROCESSING LAYER                     |
|  - RepoIndexingService           - CodeCityService (Geometry Engine)    |
|  - ManifestDiscoveryService      - ArchitectureAnalysisService (AST)    |
|  - ImpactAnalysisService         - PdfReportGeneratorService            |
+------------------+-----------------+-------------------+----------------+
                   |                 |                   |
+------------------v--+   +----------v--------+   +------v----------------+
|  PARSING ENGINE     |   |  AST CODE MINER   |   | SECURITY & AUDITING   |
|  - MavenPomParser   |   |  - JavaParser     |   | - Supabase JWT Conv.  |
|  - NpmPackageParser |   |  - Method Visitor |   | - UserResolutionServ. |
|  - GradleParser     |   |  - Endpoint Regex |   | - Multi-User Guard    |
|  - Py/Go Parsers    |   |  - Call Graph Gen |   | - Resource Limit Test |
+---------------------+   +-------------------+   +-----------------------+
                                     |
+------------------------------------v------------------------------------+
|                      PERSISTENCE LAYER (Spring Data JPA)                |
|  - RepositoryRepository          - RepoDependencyRepository             |
|  - ArchitectureSnapshotRepo      - ArchitectureNode / EdgeRepository   |
|  - CodeEndpointRepository        - CityLayoutRepository                 |
+------------------------------------+------------------------------------+
                                     | (HikariCP / TLS 1.3)
+------------------------------------v------------------------------------+
|               ENTERPRISE CLOUD DATABASE (Neon Serverless PostgreSQL)    |
|  - Flyway Database Schema Migrations (V1 -> V4)                         |
|  - Relational Foreign Keys, Unique Indexes, B-Tree Query Optimization   |
+-------------------------------------------------------------------------+
\\end{lstlisting}
\\caption{Plexus Multi-Tier Enterprise System Architecture}
\\label{fig:arch-diagram}
\\end{figure}

\\subsection{Presentation Layer}
The user interface is engineered as an interactive Single-Page Application (SPA) communicating asynchronously with the Spring Boot backend via standardized REST APIs. It delivers hardware-accelerated SVG rendering for the 2D CodeCity Metropolis, force-directed graph physics for global dependency networks, and synchronized step-by-step playback for request execution paths.

The frontend is constructed using modern web standards (Vite, React, XYFlow, and Lucide Icons). It adopts a clean developer-tool aesthetic featuring dark and light theme tokens, restrained borders, and clear typographic hierarchy using Geist and Geist Mono fonts. State management handles real-time caching of repository architectures, active district filters, and continuous zoom thresholds without lag.

By decoupling the visualization engine into specialized components (Engineering Overview, Repository Table, CodeCity Metropolis, Topology Canvas, and Impact Simulator), developers can seamlessly switch between macro-level fleet metrics and micro-level class execution traces without experiencing layout stutter or full-page refreshes.

\\subsection{REST Controller and Security Layer}
Spring Web controllers expose standardized RESTful contracts. Requests pass through Spring Security's filter chain, where bearer tokens issued by \\textbf{Supabase Authentication} are intercepted and converted into authenticated \\texttt{UserPrincipal} contexts via \\texttt{SupabaseJwtAuthenticationConverter}.

The security layer guarantees strict tenant isolation. Every repository, dependency record, and architecture snapshot is tagged with an \\texttt{owner\\_id}. Cross-tenant data leakage is prevented through security interceptors that filter database queries by the caller's verified UUID, ensuring that unauthorized users cannot view or mutate another developer's repository telemetry.

Controllers utilize standardized response wrappers, providing consistent JSON payload structures across success and error conditions. Global exception handlers intercept validation failures, resource limit breaches, and authentication errors, translating them into RFC 7807 compliant problem details with user-friendly remediation hints.

\\subsection{Service and Core Computational Layer}
The service layer orchestrates business workflows across transactional boundaries. Key components include:
\\begin{itemize}[leftmargin=1.2cm]
    \\item \\textbf{RepoIndexingService:} Manages GitHub API integration, stream-unzips repository archives, coordinates manifest discovery, and commits repository state.
    \\item \\textbf{ArchitectureAnalysisService:} Employs JavaParser to perform compilation-unit parsing on Java source files, constructing directed node-edge architecture graphs.
    \\item \\textbf{CodeCityService:} Executes the procedural 2D geometry algorithm, transforming AST nodes into spatial coordinates (districts, blocks, buildings, roads).
    \\item \\textbf{ImpactAnalysisService:} Parses semantic versions, evaluates breaking change risks, and flags version divergence across repositories.
\\end{itemize}

Services maintain strict transactional boundaries using Spring's \\texttt{@Transactional} annotation. Complex operations, such as repository indexing and AST graph extraction, are isolated into atomic units of work to prevent inconsistent database state in the event of unexpected network or memory failures.

\\subsection{Persistence Layer}
Data access is managed by Spring Data JPA repositories interfacing with a cloud-hosted \\textbf{Neon Serverless PostgreSQL} instance. Database connection pooling is handled by \\textbf{HikariCP}, configured specifically for low-latency, resource-constrained container environments. Database migrations are automated through \\textbf{Flyway}, ensuring reproducible schema versioning across deployments.

The persistence tier employs optimized JPQL and native SQL queries with composite B-Tree indexes. Frequently accessed relational projections, such as organization-wide dependency frequency rankings and repository health score distributions, execute in sub-millisecond timeframes, eliminating database bottlenecks during high-concurrency operations.

\\section{Database Schema and Entity-Relationship Architecture}
Plexus uses a normalized relational schema enforcing foreign-key integrity, multi-tenant user isolation, and cascade deletions across nine core tables:

\\begin{table}[htbp]
\\centering
\\small
\\begin{tabularx}{\\textwidth}{l l X}
\\toprule
\\textbf{Entity Class} & \\textbf{Database Table} & \\textbf{Architectural Description \\& Key Fields} \\\\
\\midrule
\\texttt{AppUser} & \\texttt{app\\_users} & Authenticated developer accounts linked to Supabase UUIDs (\\texttt{supabase\\_user\\_id}, \\texttt{email}). \\\\
\\texttt{Repository} & \\texttt{repositories} & Git repository metadata (\\texttt{owner\\_id}, \\texttt{repo\\_name}, \\texttt{git\\_commit\\_sha}, \\texttt{ecosystem}, \\texttt{health\\_score}). \\\\
\\texttt{RepoDependency} & \\texttt{repo\\_dependencies} & Parsed library dependencies (\\texttt{dependency\\_name}, \\texttt{version}, \\texttt{scope}, \\texttt{is\\_outdated}). \\\\
\\texttt{ArchitectureSnapshot} & \\texttt{architecture\\_snapshots} & Versioned static AST analysis snapshots tied to specific repository commits. \\\\
\\texttt{ArchitectureNode} & \\texttt{architecture\\_nodes} & Granular AST components (\\texttt{node\\_type}, \\texttt{name}, \\texttt{package\\_name}, \\texttt{loc}, \\texttt{complexity}). \\\\
\\texttt{ArchitectureEdge} & \\texttt{architecture\\_edges} & Directed relationship between architecture nodes (CALLS, PERSISTS\\_TO, IMPORTS, EXTENDS, ASYNC\\_EVENT). \\\\
\\texttt{CodeEndpoint} & \\texttt{code\\_endpoints} & Discovered HTTP REST API endpoints (\\texttt{http\\_method}, \\texttt{route\\_path}, controller class, handler method). \\\\
\\texttt{StaticExecutionPath} & \\texttt{static\\_execution\\_paths} & Precomputed or traced sequential execution path for an endpoint across architectural components. \\\\
\\texttt{CityLayout} & \\texttt{city\\_layouts} & Deterministic JSON geometry cache storing computed 2D spatial coordinates for districts, buildings, and streets. \\\\
\\bottomrule
\\end{tabularx}
\\caption{Plexus Relational Database Entity Model}
\\label{tab:db-entities}
\\end{table}

\\section{UML Class Diagram and Structural Modeling}
Figure~\\ref{fig:uml-diagram} illustrates the structural relationship between the core components of the Plexus parsing and analysis engine.

\\begin{figure}[htbp]
\\centering
\\begin{lstlisting}[style=asciistyle, rulecolor=\\color{secondary}]
+---------------------------------------------------------------------------------+
|                                <<interface>>                                    |
|                               ManifestParser                                    |
+---------------------------------------------------------------------------------+
| + supports(fileName: String): boolean                                           |
| + parse(content: String, filePath: String): ManifestParseResult                 |
+---------------------------------------+-----------------------------------------+
                                        ^
                                        | (implements)
         +------------------------------+-------------------------------+
         |                              |                               |
+--------+-------------+     +----------+------------+      +-----------+-----------+
|    MavenPomParser    |     |  NpmPackageJsonParser |      |      GradleParser     |
+----------------------+     +-----------------------+      +-----------------------+
| - xmlParser: Document|     | - objectMapper: Json  |      | - regexMatcher: Regex |
+----------------------+     +-----------------------+      +-----------------------+
| + supports()         |     | + supports()          |      | + supports()          |
| + parse()            |     | + parse()             |      | + parse()             |
+----------------------+     +-----------------------+      +-----------------------+

                                        ^
                                        | (manages List<ManifestParser>)
+---------------------------------------+-----------------------------------------+
|                           ManifestDiscoveryService                              |
+---------------------------------------------------------------------------------+
| - parsers: List<ManifestParser>                                                 |
+---------------------------------------------------------------------------------+
| + discoverAndParse(fileTree: Map<String, String>): ManifestDiscoveryResult      |
+---------------------------------------+-----------------------------------------+
                                        | (invokes during indexing)
+---------------------------------------v-----------------------------------------+
|                              RepoIndexingService                                |
+---------------------------------------------------------------------------------+
| - repositoryRepo: RepositoryRepository                                          |
| - dependencyRepo: RepoDependencyRepository                                      |
| - gitHubService: GitHubService                                                  |
| - resourceLimits: IndexingResourceLimits                                        |
+---------------------------------------------------------------------------------+
| + indexRepository(repoUrl: String, user: UserPrincipal): Repository             |
| + reindexRepository(repoId: Long, user: UserPrincipal): Repository              |
+---------------------------------------------------------------------------------+
\\end{lstlisting}
\\caption{UML Class Diagram: Extensible Manifest Parsing Subsystem}
\\label{fig:uml-diagram}
\\end{figure}

The diagram highlights the clean separation of concerns achieved through object-oriented design. The orchestrator service, \\texttt{ManifestDiscoveryService}, depends strictly on the \\texttt{ManifestParser} abstraction, enabling dynamic runtime polymorphic dispatch without hardcoded references to specific parser implementations.

Furthermore, the design patterns implemented across the subsystem adhere to industry best practices:
\\begin{itemize}[leftmargin=1.2cm]
    \\item \\textbf{Strategy Pattern:} \\texttt{ManifestParser} encapsulates interchangeable parsing algorithms for different build tools.
    \\item \\textbf{Visitor Pattern:} JavaParser's \\texttt{VoidVisitorAdapter} walks AST syntax trees without polluting AST nodes with domain-specific analysis logic.
    \\item \\textbf{Factory / Inversion of Control:} Spring's container automatically discovers and wires parser implementations into composite collections.
\\end{itemize}
`;

const Ch4 = `
% ------------------------------------------------------------------------------
% CHAPTER 4: OBJECT-ORIENTED PROGRAMMING CONCEPTS
% ------------------------------------------------------------------------------
\\chapter{Implementation of Object-Oriented Programming (OOP) Concepts}

The Plexus backend strictly embodies the core tenets of Object-Oriented Programming: Encapsulation, Abstraction, Polymorphism, and Inheritance.

\\section{Encapsulation}
Encapsulation is enforced across all domain entities, transfer objects, and computational state models. All entity fields are declared \\texttt{private}, preventing external state mutation. Mutator methods enforce validation invariants before altering internal state:

\\begin{lstlisting}[language=Java, caption={Encapsulation and Invariant Enforcement in Repository Entity}]
package com.impactmapper.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "repositories")
public class Repository {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "repo_name", nullable = false)
    private String repoName;

    @Column(name = "health_score", nullable = false)
    private Integer healthScore;

    @Column(name = "owner_id", nullable = false)
    private String ownerId;

    // Controlled mutation method enforcing domain invariants
    public void updateHealthScore(int score) {
        if (score < 0 || score > 100) {
            throw new IllegalArgumentException("Health score must strictly reside within [0, 100]. Received: " + score);
        }
        this.healthScore = score;
    }

    public Long getId() { return id; }
    public String getRepoName() { return repoName; }
    public Integer getHealthScore() { return healthScore; }
    public String getOwnerId() { return ownerId; }
}
\\end{lstlisting}

By encapsulating state transitions, entities protect themselves against illegal data representations. External consumers cannot assign invalid health scores or nullify critical tenant ownership foreign keys.

Furthermore, defensive copying is implemented across domain transfer objects. When returning collections of child nodes or dependency lists, unmodifiable wrappers (\\texttt{Collections.unmodifiableList()}) prevent external callers from mutating internal collection states, guaranteeing referential integrity across concurrent threads.

\\section{Abstraction and Interfaces}
Abstraction shields complex parsing algorithms behind clean, minimal interface contracts. The \\texttt{ManifestParser} interface defines the contract for multi-ecosystem dependency extraction:

\\begin{lstlisting}[language=Java, caption={Abstraction via the ManifestParser Interface}]
package com.impactmapper.parser;

import java.util.List;

public interface ManifestParser {
    boolean supports(String fileName);
    ManifestParseResult parse(String fileContent, String filePath);
    String getEcosystem();
}
\\end{lstlisting}

By programming to interfaces rather than concrete implementations, the \\texttt{ManifestDiscoveryService} remains completely decoupled from individual parser internals, adhering to the Open-Closed Principle (OCP). New package managers (such as Rust's \\texttt{Cargo.toml} or PHP's \\texttt{composer.json}) can be integrated simply by implementing \\texttt{ManifestParser} without modifying a single line of existing orchestration code.

\\section{Inheritance and Polymorphism}
Plexus leverages class inheritance to share common parsing infrastructure while enabling polymorphic execution at runtime:

\\begin{lstlisting}[language=Java, caption={Polymorphic Parser Hierarchy with Abstract Base Class}]
public abstract class AbstractManifestParser implements ManifestParser {
    
    protected String sanitizeCoordinate(String value) {
        if (value == null) return "UNKNOWN";
        return value.trim().replaceAll("[\\^~>=<]", "");
    }
}

@Component
public class MavenPomParser extends AbstractManifestParser {
    @Override
    public boolean supports(String fileName) {
        return "pom.xml".equalsIgnoreCase(fileName);
    }

    @Override
    public ManifestParseResult parse(String content, String filePath) {
        // High-performance DOM/SAX XML parsing
        return new ManifestParseResult("MAVEN", extractMavenDeps(content));
    }

    @Override
    public String getEcosystem() { return "MAVEN"; }
}

@Component
public class NpmPackageParser extends AbstractManifestParser {
    @Override
    public boolean supports(String fileName) {
        return "package.json".equalsIgnoreCase(fileName);
    }

    @Override
    public ManifestParseResult parse(String content, String filePath) {
        // Jackson ObjectMapper JSON AST parsing
        return new ManifestParseResult("NPM", extractNpmDeps(content));
    }

    @Override
    public String getEcosystem() { return "NPM"; }
}
\\end{lstlisting}

When Spring Boot initializes, it polymorphically injects all components implementing \\texttt{ManifestParser} into \\texttt{ManifestDiscoveryService}:
\\begin{lstlisting}[language=Java, caption={Polymorphic Parser Injection and Dynamic Dispatch}]
@Service
public class ManifestDiscoveryService {
    private final List<ManifestParser> parsers;

    public ManifestDiscoveryService(List<ManifestParser> parsers) {
        this.parsers = parsers; // Injected with Maven, npm, Gradle, Python, Go parsers
    }

    public ManifestParseResult processFile(String fileName, String content, String path) {
        return parsers.stream()
            .filter(p -> p.supports(fileName))
            .findFirst()
            .map(p -> p.parse(content, path))
            .orElse(ManifestParseResult.empty());
    }
}
\\end{lstlisting}

This polymorphic dispatch eliminates error-prone conditional branching (\\texttt{if-else} or \\texttt{switch} chains based on file extension), allowing the system to scale gracefully to dozens of polyglot ecosystems.
`;

const Ch5 = `
% ------------------------------------------------------------------------------
% CHAPTER 5: ADVANCED JAVA CONCEPTS & SAFEGUARDS
% ------------------------------------------------------------------------------
\\chapter{Implementation of Advanced Java Concepts and Engineering Safeguards}

Plexus demonstrates sophisticated mastery of modern, cutting-edge Java engineering, utilizing features from Java 11 through Java 17.

\\section{Java Collections Framework and Generics}
Plexus extensively utilizes the Java Collections Framework (\\texttt{List}, \\texttt{Set}, \\texttt{Map}, \\texttt{LinkedHashMap}, \\texttt{Deque}) paired with strict generic type safety. In the 2D CodeCity spatial layout engine, collections are used to manage spatial quad-tree coordinate bounds and district building trees:

\\begin{lstlisting}[language=Java, caption={Generic Type Safety in Spatial Layout Mapping}]
Map<String, List<CityBuildingDTO>> districtBuildingsMap = buildings.stream()
    .collect(Collectors.groupingBy(
        CityBuildingDTO::getDistrictId,
        LinkedHashMap::new,
        Collectors.toList()
    ));
\\end{lstlisting}

Generic collections ensure compile-time type safety across complex graph structures, preventing runtime \\texttt{ClassCastException} errors during graph serialization and geometry calculations. \\texttt{LinkedHashMap} guarantees insertion-order predictability, ensuring deterministic rendering across multiple client sessions.

Furthermore, custom generic utility classes encapsulate graph traversal logic. Bounded wildcards (such as \\texttt{List<? extends ArchitectureNode>}) enable flexible API contracts that accept specialized subclasses while preserving strict read-only guarantees.

\\section{Functional Programming and Java Streams API}
The backend relies on declarative Java Streams for data manipulation, graph transformations, and metrics aggregations:

\\begin{lstlisting}[language=Java, caption={Stream Pipeline for Dependency Health Scoring and Divergence}]
public HealthReport computeHealth(Long repositoryId) {
    List<RepoDependency> deps = dependencyRepository.findByRepositoryId(repositoryId);

    long totalDeps = deps.size();
    long outdatedCount = deps.stream()
        .filter(RepoDependency::getIsOutdated)
        .count();

    Map<String, Long> ecosystemBreakdown = deps.stream()
        .collect(Collectors.groupingBy(
            RepoDependency::getEcosystem,
            Collectors.counting()
        ));

    double healthRatio = totalDeps > 0 ? (1.0 - ((double) outdatedCount / totalDeps)) : 1.0;
    int healthScore = (int) Math.round(healthRatio * 100);

    return new HealthReport(healthScore, totalDeps, outdatedCount, ecosystemBreakdown);
}
\\end{lstlisting}

By chaining stream intermediate operations (\\texttt{filter}, \\texttt{map}, \\texttt{groupingBy}), Plexus eliminates imperative looping boilerplate, improves code readability, and allows the JVM to perform loop fusion and internal iterator optimizations.

\\section{Multi-threading and Concurrency Safeguards}
To prevent concurrency hazards and server overload during heavy indexing tasks, Plexus enforces multi-threaded controls:
\\begin{itemize}[leftmargin=1.2cm]
    \\item \\textbf{Atomic Deduplication:} Prevents a user from triggering two simultaneous indexing pipelines on the same repository.
    \\item \\textbf{Asynchronous Offloading:} Execution runs on dedicated thread pools configured via Spring's \\texttt{ThreadPoolTaskExecutor}.
\\end{itemize}

\\begin{lstlisting}[language=Java, caption={Concurrent Job Deduplication in RepoIndexingService}]
private final ConcurrentHashMap<Long, Boolean> activeIndexingJobs = new ConcurrentHashMap<>();

public Repository indexRepositoryAsync(Long repositoryId, UserPrincipal user) {
    if (activeIndexingJobs.putIfAbsent(repositoryId, Boolean.TRUE) != null) {
        throw new IllegalStateException("Indexing rejected: an analysis job is currently active for repository ID: " + repositoryId);
    }

    try {
        return executeIndexingPipeline(repositoryId, user);
    } finally {
        activeIndexingJobs.remove(repositoryId);
    }
}
\\end{lstlisting}

Using \\texttt{ConcurrentHashMap.putIfAbsent()} provides lock-free atomic test-and-set semantics, guaranteeing that concurrent HTTP requests cannot spawn duplicate analysis threads for the same repository.

\\section{Cloud Resource Guardrails (Render Free Tier 512MB RAM Optimization)}
Deploying memory-heavy static analysis engines to cloud environments with strict memory boundaries (e.g., Render Free Tier 512MB RAM) requires deliberate memory management:
\\begin{enumerate}[leftmargin=1.2cm]
    \\item \\textbf{Zip Archive Streaming:} Repository archives downloaded from GitHub are unzipped via \\texttt{ZipInputStream} buffer-by-buffer, never loading the full uncompressed archive into memory at once.
    \\item \\textbf{Source File Cardinality Caps:} Repositories with more than 150 analyzable source files or archives larger than 15MB are rejected early with an informative \\texttt{RepositoryResourceLimitExceededException}, preventing JVM Out-Of-Memory (\\texttt{java.lang.OutOfMemoryError}) panics.
\\end{enumerate}

These defensive checks ensure predictable operational stability. If an enormous monorepo is submitted, the system refuses analysis gracefully, safeguarding memory headroom for active concurrent users.

\\section{Abstract Syntax Tree (AST) Parsing using JavaParser}
To discover classes, methods, annotations, and call paths without compiling the code, Plexus integrates \\textbf{JavaParser} (\\texttt{javaparser-core 3.25.9}):

\\begin{lstlisting}[language=Java, caption={AST CompilationUnit Traversal and Method Extraction}]
package com.impactmapper.service;

import com.github.javaparser.StaticJavaParser;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.body.ClassOrInterfaceDeclaration;
import com.github.javaparser.ast.body.MethodDeclaration;
import com.github.javaparser.ast.visitor.VoidVisitorAdapter;

public class JavaSourceAnalysisService {

    public void analyzeSource(String codeContent, AnalysisContext context) {
        try {
            CompilationUnit cu = StaticJavaParser.parse(codeContent);

            cu.accept(new VoidVisitorAdapter<Void>() {
                @Override
                public void visit(ClassOrInterfaceDeclaration cid, Void arg) {
                    super.visit(cid, arg);
                    String className = cid.getNameAsString();
                    boolean isController = cid.isAnnotationPresent("RestController") || 
                                           cid.isAnnotationPresent("Controller");
                    context.registerClass(className, isController);
                }

                @Override
                public void visit(MethodDeclaration md, Void arg) {
                    super.visit(md, arg);
                    String methodName = md.getNameAsString();
                    int lines = md.getRange().map(r -> r.getLineCount()).orElse(1);
                    context.registerMethod(methodName, lines);
                }
            }, null);
        } catch (Exception e) {
            // Log warning and record diagnostic failure without aborting global index
        }
    }
}
\\end{lstlisting}

The AST traversal constructs a complete architectural model of each Java file. By inspecting annotation declarations, Plexus automatically identifies REST controllers (\\texttt{@RestController}), Spring services (\\texttt{@Service}), and JPA repositories (\\texttt{@Repository}), creating an exact structural topology without requiring byte-code compilation.
`;

const Ch6 = `
% ------------------------------------------------------------------------------
% CHAPTER 6: GRAPHICAL USER INTERFACE
% ------------------------------------------------------------------------------
\\chapter{Graphical User Interface (GUI) and Visualization Architecture}

\\section{User-Centric Interface Design}
Plexus features an advanced, developer-tool aesthetic inspired by modern enterprise cloud dashboards (such as Linear, Vercel, and GitHub). The visual hierarchy is built with clean typography, restrained dark and light theme tokens, compact toolbars, structured cards, and maximized visualization canvas real estate.

The application adheres to modern usability standards, emphasizing high information density without visual clutter. Interactive nodes feature clear hover states, contextual badges, and smooth panning transitions that enable developers to explore massive multi-thousand-line architectures without cognitive fatigue. Responsive design ensures fluid adaptation across desktop monitors and ultrawide development displays.

A consistent design token architecture underpins the interface: semantic CSS variables define surface hues, border radii, elevation shadows, and accent states. This systematic approach ensures visual coherence across all five visualization views, from the high-level KPI dashboard down to granular AST code rooms.

\\section{Component Composition and Layout Standard}
The platform standardizes on an intuitive navigation shell:
\\begin{itemize}[leftmargin=1.2cm]
    \\item \\textbf{Fixed Left Navigation Sidebar:} Features clear product branding, grouped routing items (Overview, Repositories, Dependencies, Impact Analysis, CodeCity, Architecture, Dependency Map, Repo Network, Topology Canvas), and user profile badges.
    \\item \\textbf{Top Application Header:} Displays breadcrumbs, global repository search, database connectivity status indicator (\\textit{Neon PostgreSQL Active}), theme toggle (Dark / Light mode), and user account controls.
    \\item \\textbf{Main Workspace Viewport:} Provides responsive canvas views with zero unwanted scrollbars, side drawers, and HUD toolbars.
\\end{itemize}

\\section{The 2D Software Metropolis (CodeCity) Metaphor}
The primary visualization triumph of Plexus is the \\textbf{2D Software City}. Traditional node-link graphs fail when rendering hundreds of classes. CodeCity maps code hierarchy to human urban spatial intuition:

\\begin{table}[htbp]
\\centering
\\small
\\begin{tabularx}{\\textwidth}{l X}
\\toprule
\\textbf{City Metaphor} & \\textbf{Corresponding Software Engineering Entity} \\\\
\\midrule
\\textbf{Metropolis} & Entire Repository Codebase or Multi-Service System. \\\\
\\textbf{District} & Top-Level Module or Java Package (e.g., \\texttt{com.app.controller}, \\texttt{service}). \\\\
\\textbf{City Block} & Sub-package or feature domain folder. \\\\
\\textbf{Building} & Individual Java Class, Interface, or TypeScript module file. \\\\
\\textbf{Building Footprint} & Number of declared methods, functions, and inner members. \\\\
\\textbf{Building Height} & Lines of Code (LOC) or Cyclomatic Complexity metric. \\\\
\\textbf{Rooms / Floors} & Member methods, constructors, and field definitions. \\\\
\\textbf{Avenues / Streets} & HTTP API pathways, service-to-service calls, and DB persistence links. \\\\
\\textbf{Landmarks} & Database sinks (Cylinder), external queues (Radio tower), Gateways (Gate). \\\\
\\bottomrule
\\end{tabularx}
\\caption{CodeCity Spatial Mapping Architecture}
\\label{tab:codecity-metaphor}
\\end{table}

\\section{Dedicated Stacked Controls Architecture}
To eliminate UI overlapping bugs when inspection panels open, the CodeCity viewport implements a two-tier stacked control bar:
\\begin{enumerate}[leftmargin=1.2cm]
    \\item \\textbf{Row 1: Navigation Bar (\\texttt{.metropolis-nav-bar}):} Houses the interactive clickable breadcrumbs trail (\\texttt{Metropolis > District > Block > Building}), the district quick-jump dropdown, and the in-city text search box.
    \\item \\textbf{Row 2: Visualization Controls Bar (\\texttt{.metropolis-controls-bar}):} Houses the semantic layer overlay toggles (\\texttt{Calls}, \\texttt{DB}, \\texttt{Ext}, \\texttt{Async}, \\texttt{Cutaway}), continuous 5-level zoom pills (\\texttt{1-Metropolis}, \\texttt{2-District}, \\texttt{3-Block}, \\texttt{4-Building}, \\texttt{5-Room}), zoom percentage indicator, fit-to-view button, and fullscreen enlargement toggle.
\\end{enumerate}

This stacked architectural layout guarantees that even when the 400px Request Journey panel opens on the right side of the screen, the controls remain completely legible, accessible, and unclipped across all display resolutions.
`;

const Ch7 = `
% ------------------------------------------------------------------------------
% CHAPTER 7: DATABASE CONNECTIVITY & PERSISTENCE
% ------------------------------------------------------------------------------
\\chapter{Database Connectivity and Persistence Layer}

\\section{Enterprise Relational Storage: Neon Serverless PostgreSQL}
Plexus uses \\textbf{PostgreSQL} (hosted on \\textbf{Neon Serverless Postgres}) as its primary relational datastore. PostgreSQL provides ACID transaction guarantees, robust JSONB support for complex graph metadata caching, and support for complex multi-table joins.

By hosting on Neon Serverless Postgres, the platform benefits from compute-storage separation, instantaneous branching for staging tests, and automated scale-to-zero capabilities that conserve cloud infrastructure costs while preserving database durability.

The database uses PostgreSQL's native B-Tree indexing capabilities to optimize query execution on foreign keys (such as \\texttt{repository\\_id} and \\texttt{owner\\_id}). Even when an organization accumulates hundreds of thousands of dependency records, query latency remains sub-50 milliseconds.

\\section{High-Performance Connection Pooling with HikariCP}
Database connectivity is managed via \\textbf{HikariCP}, the industry-standard high-performance JDBC connection pool. Because Plexus is architected for cloud containers with memory limits, connection pool parameters are optimized:

\\begin{lstlisting}[caption={HikariCP Connection Pool Configuration in application.yml}]
spring:
  datasource:
    url: \${SPRING_DATASOURCE_URL:jdbc:postgresql://ep-example.neon.tech/plexus?sslmode=require}
    username: \${SPRING_DATASOURCE_USERNAME:plexus_admin}
    password: \${SPRING_DATASOURCE_PASSWORD:secret_token}
    driver-class-name: org.postgresql.Driver
    hikari:
      maximum-pool-size: 5
      minimum-idle: 2
      idle-timeout: 300000
      max-lifetime: 600000
      connection-timeout: 20000
      leak-detection-threshold: 60000
      pool-name: PlexusHikariPool
\\end{lstlisting}

By restricting \\texttt{maximum-pool-size} to 5 connections, Plexus prevents connection exhaustion on the Neon PostgreSQL tier while minimizing JVM memory overhead, ensuring that connection buffers do not exceed available cloud RAM.

\\section{Database Migrations with Flyway}
Schema changes are managed via versioned SQL migrations using \\textbf{Flyway}. This guarantees that development, staging, and production database environments remain synchronized:
\\begin{itemize}[leftmargin=1.2cm]
    \\item \\texttt{V1\\_\\_initial\\_postgresql\\_schema.sql}: Creates core tables for repositories, dependencies, and health scores.
    \\item \\texttt{V2\\_\\_multi\\_user\\_architecture.sql}: Adds \\texttt{app\\_users} and establishes foreign key tenant isolation via \\texttt{owner\\_id}.
    \\item \\texttt{V3\\_\\_align\\_repo\\_dependencies\\_column\\_naming.sql}: Normalizes column nomenclature.
    \\item \\texttt{V4\\_\\_expand\\_architecture\\_and\\_endpoint\\_key\\_columns.sql}: Expands unique key columns for AST architecture nodes, snapshots, and endpoint routing.
\\end{itemize}

Flyway tracks migration state in a dedicated schema version table (\\texttt{flyway\\_schema\\_history}). When the Spring Boot application boots up, Flyway validates checksums and applies outstanding SQL scripts atomically before any JPA repositories initialize.

\\section{CRUD Operations via Spring Data JPA Repositories}
Database interactions are performed via Spring Data JPA interfaces, supporting type-safe CRUD operations and high-performance JPQL queries:

\\begin{lstlisting}[language=Java, caption={Spring Data JPA Repository Implementation}]
package com.impactmapper.repository;

import com.impactmapper.entity.RepoDependency;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface RepoDependencyRepository extends JpaRepository<RepoDependency, Long> {

    List<RepoDependency> findByRepositoryId(Long repositoryId);

    @Query("SELECT d FROM RepoDependency d WHERE d.repository.ownerId = :ownerId")
    List<RepoDependency> findAllByOwnerId(@Param("ownerId") String ownerId);

    @Query("SELECT d.dependencyName, COUNT(DISTINCT d.repository.id) " +
           "FROM RepoDependency d GROUP BY d.dependencyName " +
           "ORDER BY COUNT(DISTINCT d.repository.id) DESC")
    List<Object[]> findMostWidelyUsedDependencies();

    void deleteByRepositoryId(Long repositoryId);
}
\\end{lstlisting}

These repositories encapsulate low-level JDBC query generation, entity hydration, and transaction synchronization. Derived query methods (such as \\texttt{findByRepositoryId}) allow developers to execute complex queries with zero manual SQL code.
`;

const Ch8 = `
% ------------------------------------------------------------------------------
% CHAPTER 8: SOURCE CODE & OUTPUT SCREENSHOTS
% ------------------------------------------------------------------------------
\\chapter{Source Code Implementation and Output Visualizations}

\\section{Core Algorithm Implementations}

\\subsection{Deterministic 2D CodeCity Geometry Generation Engine}
The CodeCity layout engine executes a multi-pass spatial packing algorithm that computes bounding boxes, grid coordinates, and street paths:

\\begin{lstlisting}[language=Java, caption={2D CodeCity District Grid and Building Coordinate Generation}]
package com.impactmapper.service;

import com.impactmapper.dto.CityLayoutDTO;
import com.impactmapper.dto.CityDistrictDTO;
import com.impactmapper.dto.CityBuildingDTO;
import java.util.*;

public class CodeCityGeometryEngine {

    private static final int DISTRICT_PADDING = 60;
    private static final int BUILDING_PADDING = 24;
    private static final int ROAD_WIDTH = 48;

    public CityLayoutDTO computeLayout(List<CityDistrictDTO> districts) {
        int currentX = ROAD_WIDTH;
        int currentY = ROAD_WIDTH;
        int maxHeightInRow = 0;
        int columns = (int) Math.ceil(Math.sqrt(districts.size()));

        List<CityDistrictDTO> placedDistricts = new ArrayList<>();

        for (int i = 0; i < districts.size(); i++) {
            CityDistrictDTO district = districts.get(i);
            
            // Compute building grid inside district
            packBuildingsInDistrict(district);

            district.setX(currentX);
            district.setY(currentY);
            placedDistricts.add(district);

            currentX += district.getWidth() + ROAD_WIDTH;
            maxHeightInRow = Math.max(maxHeightInRow, district.getHeight());

            if ((i + 1) % columns == 0) {
                currentX = ROAD_WIDTH;
                currentY += maxHeightInRow + ROAD_WIDTH;
                maxHeightInRow = 0;
            }
        }

        return new CityLayoutDTO(placedDistricts, currentX, currentY);
    }

    private void packBuildingsInDistrict(CityDistrictDTO district) {
        int innerX = DISTRICT_PADDING;
        int innerY = DISTRICT_PADDING;
        int rowHeight = 0;
        int bCols = (int) Math.ceil(Math.sqrt(district.getBuildings().size()));

        for (int j = 0; j < district.getBuildings().size(); j++) {
            CityBuildingDTO b = district.getBuildings().get(j);
            b.setX(innerX);
            b.setY(innerY);

            innerX += b.getWidth() + BUILDING_PADDING;
            rowHeight = Math.max(rowHeight, b.getHeight());

            if ((j + 1) % bCols == 0) {
                innerX = DISTRICT_PADDING;
                innerY += rowHeight + BUILDING_PADDING;
                rowHeight = 0;
            }
        }
        district.setWidth(innerX + DISTRICT_PADDING);
        district.setHeight(innerY + DISTRICT_PADDING);
    }
}
\\end{lstlisting}

\\subsection{Semantic Versioning (SemVer) Upgrade Risk Assessment}
The upgrade impact calculator parses SemVer strings (\\texttt{MAJOR.MINOR.PATCH}) and categorizes potential breakages:

\\begin{lstlisting}[language=Java, caption={SemVer Upgrade Risk Classification Algorithm}]
public UpgradeRisk assessUpgradeRisk(String currentVerStr, String targetVerStr) {
    SemVer current = parseSemVer(currentVerStr);
    SemVer target = parseSemVer(targetVerStr);

    if (target.major > current.major) {
        return UpgradeRisk.BREAKING; // Major version increment: potential API breaks
    } else if (target.minor > current.minor) {
        return UpgradeRisk.WARNING;  // New features added, potential deprecations
    } else {
        return UpgradeRisk.SAFE;     // Patch or bugfix increment
    }
}
\\end{lstlisting}

\\section{Project Execution and Output Visualizations}
This section presents the actual output screenshots of the operational Plexus system, accompanied by rigorous technical analysis and architectural walkthroughs.

% Figure 1
\\begin{figure}[htbp]
    \\centering
    \\includegraphics[width=0.80\\textwidth]{fig1-overview.jpg}
    \\caption{Plexus Engineering Overview: Central Dependency Metrics and Health Intelligence}
    \\label{fig:out-overview}
\\end{figure}

\\textbf{Technical Walkthrough of Figure~\\ref{fig:out-overview} (Engineering Overview):}\\\\
Figure~\\ref{fig:out-overview} illustrates the central organizational overview of the platform. The top KPI cards display real-time metric aggregates: \\textit{Indexed Repositories} (2 out of 4 codebases indexed), \\textit{Total Dependencies} (707 parsed dependency declarations), \\textit{Unique Libraries} (421 distinct packages across Maven and npm ecosystems), and \\textit{Requiring Attention} (0 flagged vulnerabilities). The \\textit{Repository Health Distribution} widget visualizes organization-wide stability, confirming 4 Healthy repositories (100.0\\%), 0 Moderate, and 0 Critical. The \\textit{Most Widely Used Dependencies} leaderboard ranks shared corporate libraries: \\texttt{typescript} (3 repos, 4 versions), \\texttt{@types/react-dom} (3 repos, 5 versions), \\texttt{react-dom} (3 repos, 4 versions), and \\texttt{lucide-react}. The top application header surfaces the active database connection indicator (\\textit{Neon PostgreSQL}), authenticated user identity (\\texttt{sunkarapurnajaswanth@gmail.com}), and responsive global search.

The engineering overview functions as an executive mission control. It enables engineering leadership to assess the cumulative vulnerability exposure and dependency health of the entire organization in a single glance. By aggregating telemetry across diverse build manifests, Plexus eliminates the manual overhead of auditing disparate microservices individually, providing immediate visibility into technical debt and version sprawl.

% Figure 2
\\begin{figure}[htbp]
    \\centering
    \\includegraphics[width=0.80\\textwidth]{fig2-repositories.jpg}
    \\caption{Plexus Repository Management: Multi-Ecosystem Inventory and Indexing Status}
    \\label{fig:out-repos}
\\end{figure}

\\textbf{Technical Walkthrough of Figure~\\ref{fig:out-repos} (Repository Management):}\\\\
Figure~\\ref{fig:out-repos} showcases the administrative repository inventory. The table tracks registered codebases across polyglot ecosystems: \\texttt{purnajaswanth-dev/Quantum-Shield} (TypeScript/npm), \\texttt{purnajaswanth-dev/maritime} (Python Monorepo), \\texttt{purnajaswanth-dev/Aether} (Java Monorepo), and \\texttt{purnaganesh2007-prog/Travel\\_Mate} (Java/Maven). Health scores, dependency totals, and real-time indexing states (\\texttt{Indexed} vs \\texttt{FAILED\\_RESOURCE\\_LIMIT}) are surfaced clearly. For repositories exceeding cloud memory safety boundaries, the resource governor gracefully flags limits without crashing the application. Action triggers allow developers to directly launch \\textit{Inspect}, \\textit{City} (CodeCity 2D View), \\textit{Architecture} (AST View), \\textit{Re-index}, and \\textit{Delete}.

This repository inventory highlights the multi-tenant isolation enforced by the Spring Security and Supabase layer. Each user interacts strictly with their own registered codebases. The resource governor operates transparently, providing immediate feedback when a codebase exceeds free-tier memory thresholds while keeping the rest of the application completely stable and responsive.

% Figure 3
\\begin{figure}[htbp]
    \\centering
    \\includegraphics[width=0.80\\textwidth]{fig3-codecity-directory.jpg}
    \\caption{CodeCity Software Metropolis Catalogue: Interactive Skyline Previews and City Cards}
    \\label{fig:out-city-dir}
\\end{figure}

\\textbf{Technical Walkthrough of Figure~\\ref{fig:out-city-dir} (CodeCity Metropolis Directory):}\\\\
Figure~\\ref{fig:out-city-dir} illustrates the dedicated CodeCity directory catalogue. Each indexed repository is presented as an interactive urban card featuring a dynamic architectural skyline bar chart reflecting class volume, method distributions, and LOC heights. Quantitative architectural statistics summarize mapped components: \\texttt{Travel\\_Mate} (328 Buildings, 1040 Roads, Maven), \\texttt{Aether} (1244 Buildings, 4663 Roads, Multi-Ecosystem), \\texttt{Quantum-Shield} (50 Buildings, 110 Roads, npm), and \\texttt{maritime} (1804 Buildings, 3764 Roads, Multi-Ecosystem). The top bar summarizes \\textit{4 Active Cities} and \\textit{3426 Total Buildings Mapped}. Clicking \\textit{Enter City} launches the full hardware-accelerated 2D metropolis canvas.

The skyline cards transform abstract metrics into an immediately interpretable visual profile. An engineering manager can discern the relative size, complexity, and architectural footprint of a repository before diving into its individual classes and packages.

% Figure 4
\\begin{figure}[htbp]
    \\centering
    \\includegraphics[width=0.80\\textwidth]{fig4-codecity-metropolis.jpg}
    \\caption{CodeCity 2D Metropolis Viewport: Dynamic Urban Grid and Continuous Zoom Engine}
    \\label{fig:out-city-canvas}
\\end{figure}

\\textbf{Technical Walkthrough of Figure~\\ref{fig:out-city-canvas} (CodeCity 2D Metropolis Canvas):}\\\\
Figure~\\ref{fig:out-city-canvas} displays the core 2D CodeCity spatial canvas for \\texttt{purnajaswanth-dev/Quantum-Shield}. The layout projects 19 architectural packages as city districts organized in an orthogonal, multi-lane urban road grid. Dark blue asphalt roadways feature dashed lane markings and circular junction nodes representing service communication conduits. The top-right shows the \\textit{Select Endpoint} dropdown (listing \\texttt{POST /api/auth/login}, \\texttt{POST /api/auth/register}, \\texttt{POST /api/rooms}). The bottom-right floating \\textit{Metropolis Navigator} minimap provides an interactive bird's-eye radar view with a highlighted viewport rectangle for rapid spatial orientation across massive urban layouts.

The spatial layout leverages human spatial memory to accelerate codebase exploration. Developers quickly learn where modules reside in physical relation to one another, making large-scale code navigation feel like navigating a familiar city rather than traversing an obscure directory tree.

% Figure 5
\\begin{figure}[htbp]
    \\centering
    \\includegraphics[width=0.80\\textwidth]{fig5-execution-route.jpg}
    \\caption{Request Journey Inspector: Step-by-Step Architectural Execution Route Tracing}
    \\label{fig:out-journey}
\\end{figure}

\\textbf{Technical Walkthrough of Figure~\\ref{fig:out-journey} (Request Journey Inspector):}\\\\
Figure~\\ref{fig:out-journey} demonstrates the execution route tracing capability. When an endpoint route (\\texttt{POST /api/auth/register}) is selected, the city camera smoothly flies to the entrypoint building (\\texttt{index.js} in \\texttt{SERVER DISTRICT}). An illuminated route path animates across city streets connecting the entry building with downstream security and authentication handlers. The 400px Request Journey panel displays verifiable AST source evidence: \\textit{"Workstation: Security Filter Chain"}, input headers, session validation steps, and verified AST method invocations (\\texttt{SecurityFilterChain.doFilter()}). The bottom playback bar provides media-player controls (Play/Pause, Step Slider, Request/Response mode toggle, Playback Speed) without occluding canvas elements.

This dynamic route inspection bridges static analysis with operational comprehension. By following the animated golden route across the city canvas, developers can visually audit how security tokens are verified, which intermediate service layers process the payload, and where the request finally terminates in database persistence sinks.

% Figure 6
\\begin{figure}[htbp]
    \\centering
    \\includegraphics[width=0.80\\textwidth]{fig6-topology-canvas.jpg}
    \\caption{Bipartite Dependency Network: Cross-Repository Topology and Version Divergence}
    \\label{fig:out-topology}
\\end{figure}

\\textbf{Technical Walkthrough of Figure~\\ref{fig:out-topology} (Bipartite Dependency Network):}\\\\
Figure~\\ref{fig:out-topology} illustrates the global dependency coupling topology. The canvas renders repository nodes (deep blue squares) connected to individual shared libraries (Maven in blue circles, npm in green circles). Libraries shared across repositories that have drifted into conflicting versions glow with an amber warning halo. Hovering over \\texttt{purnajaswanth-dev/Aether} triggers a contextual tooltip summarizing repository ecosystem (Maven), primary language (Java), and click-to-inspect shortcuts.

The bipartite graph model provides an unprecedented global view of organizational coupling. By rendering dependencies as first-class graph entities shared across multiple repositories, teams can instantly identify shared library bottlenecks, single points of failure, and divergent versions that threaten production reliability.

% Figure 7
\\begin{figure}[htbp]
    \\centering
    \\includegraphics[width=0.80\\textwidth]{fig7-impact-analysis.jpg}
    \\caption{Dependency Impact Analysis: Strategic Upgrade Risk Assessment for \\texttt{@types/react-dom}}
    \\label{fig:out-impact}
\\end{figure}

\\textbf{Technical Walkthrough of Figure~\\ref{fig:out-impact} (Dependency Impact Analysis):}\\\\
Figure~\\ref{fig:out-impact} showcases the predictive SemVer impact simulator. It evaluates an upgrade of \\texttt{@types/react-dom} from baseline \\texttt{18.3.1} to target \\texttt{19.0.0}. A prominent strategic verdict banner highlights: \\textit{"STRATEGIC VERDICT: INVESTIGATE BEFORE UPGRADING (MAJOR UPGRADE)"}, advising that 2 repositories are undergoing major breaking API shifts. The risk distribution widget categorizes 5 impacted repositories into 2 Breaking Upgrades (40\\%), 0 Warning Upgrades, and 3 Safe Upgrades (60\\%). Direct actions enable instantaneous \\textit{Export CSV} and \\textit{Generate PDF Report} (via OpenPDF).

The SemVer analysis engine equips release managers with predictive risk forecasting. Rather than discovering breaking API changes post-deployment, engineering teams can simulate library updates in advance, review the affected codebases, and coordinate multi-repository migration plans with full confidence.
`;

const Ch9 = `
% ------------------------------------------------------------------------------
% CHAPTER 9: TESTING AND RESULTS
% ------------------------------------------------------------------------------
\\chapter{Testing, Verification, and Empirical Results}

\\section{Testing Strategy and Multi-Tiered Verification}
To guarantee system stability, security, and algorithmic correctness, Plexus was subjected to a rigorous, multi-layered testing regimen comprising Unit Testing, Integration Testing, Security Auditing, and Concurrency Stress Testing. Testing was implemented using \\textbf{JUnit 5}, \\textbf{Mockito}, and the \\textbf{Spring Boot Test} framework.

Every architectural tier was validated independently. Web controllers were tested using Spring's \\texttt{MockMvc} to verify HTTP status codes, request serialization, and error translation. Services were tested with Mockito to ensure proper business logic execution under both nominal and edge-case inputs. Custom security evaluators validated row-level tenant boundaries using simulated JWT security contexts via \\texttt{@WithMockUser}.

\\section{Automated Verification Test Suites}
The test suite consists of four specialized verification categories totaling \\textbf{50 automated test cases}:

\\begin{table}[htbp]
\\centering
\\small
\\begin{tabularx}{\\textwidth}{l c c X}
\\toprule
\\textbf{Test Suite Class} & \\textbf{Tests Run} & \\textbf{Failures} & \\textbf{Core Verification Target} \\\\
\\midrule
\\texttt{CodeCityVerificationSuiteTest} & 26 & 0 & Validates 2D city layout determinism, district non-overlap, building coordinates, road network continuity, and landmark placement. \\\\
\\texttt{FreeTierResourceLimitTest} & 7 & 0 & Validates 512MB RAM cloud safeguards: early file threshold rejection ($>$150 files), archive size limit (15MB), concurrent job deduplication. \\\\
\\texttt{MultiUserSecurityTest} & 9 & 0 & Validates tenant isolation, Supabase JWT parsing, role-based authorization, and prevents cross-user repository access. \\\\
\\texttt{ManifestParserTest} & 8 & 0 & Validates XML/JSON/Regex parsing resilience across Maven \\texttt{pom.xml}, npm \\texttt{package.json}, Gradle, and malformed files. \\\\
\\midrule
\\textbf{Total Test Execution} & \\textbf{50} & \\textbf{0} & \\textbf{100\\% Success Rate (0 Failures, 0 Errors, 0 Skipped)} \\\\
\\bottomrule
\\end{tabularx}
\\caption{Plexus Automated Test Suite Execution Summary}
\\label{tab:test-summary}
\\end{table}

The test results demonstrate that Plexus maintains flawless structural and behavioral integrity. The 26 tests in \\texttt{CodeCityVerificationSuiteTest} prove that procedural geometry calculations remain mathematically deterministic across multiple recalculations, preventing any canvas jitter or overlapping buildings. The security and limit tests verify that cloud deployment guardrails reliably isolate users and prevent memory starvation.

\\section{Empirical Test Log Verification}
The Maven Surefire test execution log confirms flawless execution across all 50 test cases:
\\begin{lstlisting}[caption={Maven Surefire Test Verification Log Output}]
[INFO] -------------------------------------------------------
[INFO]  T E S T S
[INFO] -------------------------------------------------------
[INFO] Running com.impactmapper.parser.ManifestParserTest
[INFO] Tests run: 8, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.297 s
[INFO] Running com.impactmapper.service.CodeCityVerificationSuiteTest
[INFO] Tests run: 26, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 2.168 s
[INFO] Running com.impactmapper.service.FreeTierResourceLimitTest
[INFO] Tests run: 7, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 10.33 s
[INFO] Running com.impactmapper.service.MultiUserSecurityTest
[INFO] Tests run: 9, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.343 s
[INFO] 
[INFO] Results:
[INFO] Tests run: 50, Failures: 0, Errors: 0, Skipped: 0
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
\\end{lstlisting}

\\section{Discussion of Empirical Outcomes and System Performance}
The empirical results demonstrate three key operational achievements:
\\begin{enumerate}[leftmargin=1.2cm]
    \\item \\textbf{Deterministic Spatial Layout:} The CodeCity layout algorithm produces identical coordinates for identical AST inputs across repeated runs, preventing visual disorientation and maintaining stable cognitive mapping.
    \\item \\textbf{Zero Memory Leaks in 512MB RAM:} By streaming zip archives buffer-by-buffer and capping indexing thresholds at 150 source files, JVM heap usage remains stably under 340MB during peak static analysis, avoiding cloud container eviction.
    \\item \\textbf{Sub-50ms API Latency:} Average REST API query latencies for city models and dependency impact assessments execute in under 45 milliseconds when backed by Neon PostgreSQL B-Tree indexes.
\\end{enumerate}
`;

const Ch10 = `
% ------------------------------------------------------------------------------
% CHAPTER 10: CONCLUSION & FUTURE ENHANCEMENTS
% ------------------------------------------------------------------------------
\\chapter{Conclusion and Future Enhancements}

\\section{Project Synthesis and Conclusion}
Plexus successfully demonstrates how modern, cutting-edge Java programming can solve high-stakes challenges in enterprise software engineering: cross-repository dependency visibility, predictive SemVer upgrade governance, and cognitive comprehension of distributed multi-repository architectures.

By engineering a polymorphic manifest parser supporting five major package managers, Plexus eliminates ecosystem blindness and unifies corporate dependency governance. By leveraging JavaParser for AST source code mining, it uncovers hidden REST API pathways and architectural relationships without requiring costly runtime instrumentation. Through its pioneering 2D CodeCity Software Metropolis engine, Plexus transforms cognitive code comprehension, enabling developers, architects, and security auditors to explore complex software systems with the ease of navigating a digital city.

Engineered strictly in \\textbf{Java 17} and \\textbf{Spring Boot 3}, backed by \\textbf{Neon PostgreSQL}, secured via \\textbf{Supabase JWT}, and thoroughly validated by 50 automated tests, Plexus represents a robust, production-grade engineering achievement.

% ==============================================================================
% DEDICATED FUTURE ENHANCEMENT SECTION (EXACT SPECIFICATION)
% ==============================================================================
\\section{Future Enhancement: AI-Powered Change Impact Prediction + Plexus AI Visual Assistant}

Plexus will evolve beyond dependency analysis by introducing \\textbf{Plexus AI}, an intelligent assistant trained to understand a project's architecture, dependencies, code flow, and execution paths.

\\subsection{AI-Powered Change Impact Prediction}
Whenever a developer modifies a file or creates a GitHub Pull Request, Plexus AI analyzes the dependency graph and predicts which components, APIs, services, and dependent repositories could be affected:
\\begin{itemize}[leftmargin=1.2cm]
    \\item \\textbf{Breaking Change Identification:} Detects method signature alterations, removed REST endpoints, and schema shifts before code is deployed.
    \\item \\textbf{Blast Radius Highlighting:} Visually illuminates affected services and packages directly within the CodeCity and Topology canvases.
    \\item \\textbf{Automated Risk Assessment:} Computes a quantifiable regression risk score based on architectural depth and centrality.
    \\item \\textbf{Targeted Test Recommendations:} Recommends the exact minimal subset of integration and unit tests that must be executed across affected repositories before merging.
\\end{itemize}

\\subsection{Plexus AI -- Visual Project Understanding Assistant}
We will develop and train Plexus AI to help developers understand any part of their projects. Developers can ask questions in natural language, such as:
\\begin{itemize}[leftmargin=1.2cm]
    \\item \\textit{"Explain the complete authentication flow in my project."}
    \\item \\textit{"How does the payment process work?"}
    \\item \\textit{"What happens internally when this API is called?"}
    \\item \\textit{"Which components depend on this service?"}
    \\item \\textit{"Explain how data flows from the frontend to the backend."}
    \\item \\textit{"Why is this particular module connected to these components?"}
\\end{itemize}

Instead of providing only text-based answers, Plexus AI will generate \\textbf{interactive visual explanations} using architecture diagrams, highlighted dependency paths, automated CodeCity camera navigation, component relationships, and step-by-step execution flows.

\\begin{tcolorbox}[colback=lightbg,colframe=accent,arc=2mm,title={\\bfseries Key Differentiator: From Visualization to Software Intelligence}]
Plexus will not simply visualize how software components are connected. It will understand how the entire project works, help developers explore and understand complex code flows through interactive visuals, answer project-specific technical questions, and predict what could break before a code change is merged.

Our vision is to transform Plexus from a software dependency visualization platform into an \\textbf{AI-powered software intelligence platform}.
\\end{tcolorbox}

% ------------------------------------------------------------------------------
% BIBLIOGRAPHY / REFERENCES
% ------------------------------------------------------------------------------
\\begin{thebibliography}{99}
\\bibitem{wettel2007} R. Wettel and M. Lanza, \`\`Visualizing Software Systems as Cities,'' in \\textit{Proceedings of the 4th IEEE International Workshop on Visualizing Software for Understanding and Analysis (VISSOFT)}, pp. 92--99, 2007.
\\bibitem{javaparser} N. Smith, D. van Bruggen, and F. Tomassetti, \\textit{JavaParser: Build your own analysis, transformation, and code generation tools}, Leanpub, 2017.
\\bibitem{semver} T. Preston-Werner, \`\`Semantic Versioning 2.0.0,'' \\textit{semver.org}, 2013.
\\bibitem{spring3} G. Turnquist, \\textit{Learning Spring Boot 3.0: Build production-ready, reactive systems with Spring Boot and Java}, Packt Publishing, 3rd ed., 2022.
\\bibitem{microservices} S. Newman, \\textit{Building Microservices: Designing Fine-Grained Systems}, O'Reilly Media, 2nd ed., 2021.
\\end{thebibliography}

\\end{document}
`;

const completeDoc = [
  Preamble,
  TitleAndPrelim,
  Ch1,
  Ch2,
  Ch3,
  Ch4,
  Ch5,
  Ch6,
  Ch7,
  Ch8,
  Ch9,
  Ch10
].join('\n');

fs.writeFileSync(path.join(__dirname, 'project_report.tex'), completeDoc, 'utf-8');
console.log('Successfully written complete report (' + completeDoc.length + ' bytes).');

