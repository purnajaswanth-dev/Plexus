package com.impactmapper.parser;

import com.impactmapper.dto.ParsedDep;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

class ManifestParserTest {

    private MavenPomParser mavenPomParser;
    private GradleParser gradleParser;
    private NpmPackageJsonParser npmPackageJsonParser;
    private NpmLockfileParser npmLockfileParser;
    private PythonRequirementsParser pythonRequirementsParser;
    private PythonPyprojectParser pythonPyprojectParser;
    private GoModParser goModParser;
    private ManifestDiscoveryService discoveryService;

    @BeforeEach
    void setUp() {
        mavenPomParser = new MavenPomParser();
        gradleParser = new GradleParser();
        npmPackageJsonParser = new NpmPackageJsonParser();
        npmLockfileParser = new NpmLockfileParser();
        pythonRequirementsParser = new PythonRequirementsParser();
        pythonPyprojectParser = new PythonPyprojectParser();
        goModParser = new GoModParser();

        List<ManifestParser> parsers = List.of(
                mavenPomParser,
                gradleParser,
                npmPackageJsonParser,
                npmLockfileParser,
                pythonRequirementsParser,
                pythonPyprojectParser,
                goModParser
        );
        discoveryService = new ManifestDiscoveryService(parsers);
    }

    // Scenario 1: Valid repository with single pom.xml at root
    @Test
    void testScenario1_SinglePomXmlAtRoot() {
        String pom = """
            <project xmlns="http://maven.apache.org/POM/4.0.0">
                <modelVersion>4.0.0</modelVersion>
                <groupId>com.example</groupId>
                <artifactId>my-app</artifactId>
                <version>1.0.0</version>
                <properties>
                    <spring.version>3.2.5</spring.version>
                </properties>
                <dependencies>
                    <dependency>
                        <groupId>org.springframework.boot</groupId>
                        <artifactId>spring-boot-starter-web</artifactId>
                        <version>${spring.version}</version>
                    </dependency>
                    <dependency>
                        <groupId>org.junit.jupiter</groupId>
                        <artifactId>junit-jupiter</artifactId>
                        <version>5.10.0</version>
                        <scope>test</scope>
                    </dependency>
                </dependencies>
            </project>
            """;

        ManifestDiscoveryResult result = discoveryService.parseManifests(Map.of("pom.xml", pom));
        assertTrue(result.isHasManifests());
        assertFalse(result.isMonorepo());
        assertEquals("MAVEN", result.getPrimaryEcosystem());
        assertEquals(2, result.getAllDependencies().size());

        ParsedDep webDep = result.getAllDependencies().stream()
                .filter(d -> d.getArtifactId().equals("spring-boot-starter-web"))
                .findFirst().orElseThrow();
        assertEquals("3.2.5", webDep.getVersion());
        assertEquals("compile", webDep.getScope());
        assertFalse(webDep.isDev());
        assertEquals("pom.xml", webDep.getManifestPath());

        ParsedDep testDep = result.getAllDependencies().stream()
                .filter(d -> d.getArtifactId().equals("junit-jupiter"))
                .findFirst().orElseThrow();
        assertEquals("test", testDep.getScope());
        assertTrue(testDep.isDev());
    }

    // Scenario 2: Valid repository with single package.json at root
    @Test
    void testScenario2_SinglePackageJsonAtRoot() {
        String packageJson = """
            {
              "name": "frontend-app",
              "version": "1.0.0",
              "dependencies": {
                "react": "^18.2.0",
                "axios": "~1.6.0"
              },
              "devDependencies": {
                "vite": "^5.0.0",
                "typescript": "^5.2.0"
              }
            }
            """;

        ManifestDiscoveryResult result = discoveryService.parseManifests(Map.of("package.json", packageJson));
        assertTrue(result.isHasManifests());
        assertFalse(result.isMonorepo());
        assertEquals("NPM", result.getPrimaryEcosystem());
        assertEquals(4, result.getAllDependencies().size());

        ParsedDep react = result.getAllDependencies().stream()
                .filter(d -> d.getArtifactId().equals("react"))
                .findFirst().orElseThrow();
        assertEquals("18.2.0", react.getVersion());
        assertFalse(react.isDev());
        assertEquals("runtime", react.getScope());

        ParsedDep vite = result.getAllDependencies().stream()
                .filter(d -> d.getArtifactId().equals("vite"))
                .findFirst().orElseThrow();
        assertEquals("5.0.0", vite.getVersion());
        assertTrue(vite.isDev());
        assertEquals("dev", vite.getScope());
    }

    // Scenario 3: Multi-project repository with nested pom.xml files
    @Test
    void testScenario3_MultiProjectNestedPoms() {
        String rootPom = """
            <project>
                <groupId>com.corp</groupId>
                <artifactId>parent</artifactId>
                <version>2.0.0</version>
                <modules>
                    <module>core</module>
                    <module>service</module>
                </modules>
            </project>
            """;

        String corePom = """
            <project>
                <parent>
                    <groupId>com.corp</groupId>
                    <artifactId>parent</artifactId>
                    <version>2.0.0</version>
                </parent>
                <artifactId>core</artifactId>
                <dependencies>
                    <dependency>
                        <groupId>com.google.guava</groupId>
                        <artifactId>guava</artifactId>
                        <version>32.1.2-jre</version>
                    </dependency>
                </dependencies>
            </project>
            """;

        String servicePom = """
            <project>
                <parent>
                    <groupId>com.corp</groupId>
                    <artifactId>parent</artifactId>
                    <version>2.0.0</version>
                </parent>
                <artifactId>service</artifactId>
                <dependencies>
                    <dependency>
                        <groupId>org.apache.commons</groupId>
                        <artifactId>commons-lang3</artifactId>
                        <version>3.13.0</version>
                    </dependency>
                </dependencies>
            </project>
            """;

        Map<String, String> manifests = new LinkedHashMap<>();
        manifests.put("pom.xml", rootPom);
        manifests.put("core/pom.xml", corePom);
        manifests.put("service/pom.xml", servicePom);

        ManifestDiscoveryResult result = discoveryService.parseManifests(manifests);
        assertTrue(result.isHasManifests());
        assertTrue(result.isMonorepo());
        assertEquals("MAVEN", result.getPrimaryEcosystem());
        assertEquals(2, result.getAllDependencies().size());

        assertTrue(result.getAllDependencies().stream()
                .anyMatch(d -> d.getArtifactId().equals("guava") && d.getManifestPath().equals("core/pom.xml")));
        assertTrue(result.getAllDependencies().stream()
                .anyMatch(d -> d.getArtifactId().equals("commons-lang3") && d.getManifestPath().equals("service/pom.xml")));
    }

    // Scenario 4: Monorepo with both pom.xml and package.json (e.g. purnajaswanth-dev/Aether)
    @Test
    void testScenario4_MonorepoBothPomAndPackageJson() {
        String backendPom = """
            <project>
                <groupId>com.aether</groupId>
                <artifactId>aether-backend</artifactId>
                <dependencies>
                    <dependency>
                        <groupId>org.springframework.boot</groupId>
                        <artifactId>spring-boot-starter-web</artifactId>
                        <version>3.3.5</version>
                    </dependency>
                </dependencies>
            </project>
            """;

        String frontendPkg = """
            {
              "name": "aether-frontend",
              "dependencies": {
                "react": "18.3.1"
              }
            }
            """;

        Map<String, String> manifests = Map.of(
                "backend/pom.xml", backendPom,
                "frontend/package.json", frontendPkg
        );

        ManifestDiscoveryResult result = discoveryService.parseManifests(manifests);
        assertTrue(result.isHasManifests());
        assertTrue(result.isMonorepo());
        assertEquals("MULTI_ECOSYSTEM", result.getPrimaryEcosystem());
        assertEquals(2, result.getAllDependencies().size());
        assertTrue(result.getEcosystems().contains("MAVEN"));
        assertTrue(result.getEcosystems().contains("NPM"));
    }

    // Scenario 5: Repository with build.gradle and build.gradle.kts
    @Test
    void testScenario5_GradleGroovyAndKotlinDsl() {
        String groovyGradle = """
            plugins {
                id 'java'
            }
            dependencies {
                implementation 'org.springframework.boot:spring-boot-starter:3.2.0'
                testImplementation 'org.junit.jupiter:junit-jupiter-api:5.9.2'
            }
            """;

        String kotlinGradle = """
            plugins {
                kotlin("jvm") version "1.9.20"
            }
            dependencies {
                implementation("com.squareup.okhttp3:okhttp:4.12.0")
            }
            """;

        ManifestDiscoveryResult r1 = discoveryService.parseManifests(Map.of("build.gradle", groovyGradle));
        assertEquals("GRADLE", r1.getPrimaryEcosystem());
        assertEquals(2, r1.getAllDependencies().size());

        ManifestDiscoveryResult r2 = discoveryService.parseManifests(Map.of("build.gradle.kts", kotlinGradle));
        assertEquals("GRADLE", r2.getPrimaryEcosystem());
        assertEquals(1, r2.getAllDependencies().size());
        assertEquals("okhttp", r2.getAllDependencies().get(0).getArtifactId());
    }

    // Scenario 6: Repository with requirements.txt and pyproject.toml
    @Test
    void testScenario6_PythonRequirementsAndPyproject() {
        String requirements = """
            # Web framework
            fastapi>=0.104.0; python_version >= '3.8'
            uvicorn[standard]==0.24.0
            pytest>=7.4.0 # test dependency
            """;

        String pyproject = """
            [tool.poetry.dependencies]
            python = "^3.10"
            requests = "^2.31.0"
            pydantic = { version = "^2.5.0" }

            [tool.poetry.group.dev.dependencies]
            black = "^23.10.0"
            """;

        ManifestDiscoveryResult r1 = discoveryService.parseManifests(Map.of("requirements.txt", requirements));
        assertEquals("PYTHON", r1.getPrimaryEcosystem());
        assertEquals(3, r1.getAllDependencies().size());

        ManifestDiscoveryResult r2 = discoveryService.parseManifests(Map.of("pyproject.toml", pyproject));
        assertEquals("PYTHON", r2.getPrimaryEcosystem());
        assertEquals(3, r2.getAllDependencies().size());
        assertTrue(r2.getAllDependencies().stream().anyMatch(d -> d.getArtifactId().equals("requests") && d.getVersion().equals("2.31.0")));
        assertTrue(r2.getAllDependencies().stream().anyMatch(d -> d.getArtifactId().equals("black") && d.isDev()));
    }

    // Scenario 7: Repository with go.mod
    @Test
    void testScenario7_GoMod() {
        String goMod = """
            module github.com/purnajaswanth-dev/Aether/agent

            go 1.21

            require (
                github.com/gin-gonic/gin v1.9.1
                github.com/stretchr/testify v1.8.4 // indirect
            )
            """;

        ManifestDiscoveryResult result = discoveryService.parseManifests(Map.of("agent/go.mod", goMod));
        assertEquals("GO", result.getPrimaryEcosystem());
        assertEquals(2, result.getAllDependencies().size());

        ParsedDep gin = result.getAllDependencies().stream()
                .filter(d -> d.getArtifactId().equals("gin"))
                .findFirst().orElseThrow();
        assertEquals("github.com/gin-gonic", gin.getGroupId());
        assertEquals("1.9.1", gin.getVersion());
        assertEquals("direct", gin.getScope());

        ParsedDep testify = result.getAllDependencies().stream()
                .filter(d -> d.getArtifactId().equals("testify"))
                .findFirst().orElseThrow();
        assertEquals("indirect", testify.getScope());
    }

    // Scenario 9: Repository with malformed manifest file (graceful failure and diagnostics)
    @Test
    void testScenario9_MalformedManifestFiles() {
        String badXml = "<project><broken>";
        String badJson = "{ \"name\": \"broken\", dependencies: { ... }";
        String badToml = "[invalid section [[";

        ManifestParseResult rPom = mavenPomParser.parse("pom.xml", badXml);
        assertFalse(rPom.isSuccess());
        assertFalse(rPom.getDiagnostics().isEmpty());

        ManifestParseResult rNpm = npmPackageJsonParser.parse("package.json", badJson);
        assertFalse(rNpm.isSuccess());
        assertFalse(rNpm.getDiagnostics().isEmpty());

        ManifestParseResult rPy = pythonPyprojectParser.parse("pyproject.toml", badToml);
        // Should handle gracefully without throwing uncaught exceptions
        assertNotNull(rPy);
    }
}

