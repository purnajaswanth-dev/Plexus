package com.impactmapper.service;

import com.impactmapper.dto.ParsedDep;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class RepoDependencyParserServiceTest {

    private RepoDependencyParserService parserService;

    @BeforeEach
    void setUp() {
        parserService = new RepoDependencyParserService();
    }

    @Test
    void testParsePomXml() {
        String pomXml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
                "<project xmlns=\"http://maven.apache.org/POM/4.0.0\">\n" +
                "    <modelVersion>4.0.0</modelVersion>\n" +
                "    <groupId>com.example</groupId>\n" +
                "    <artifactId>demo-app</artifactId>\n" +
                "    <version>1.0.0</version>\n" +
                "    <dependencies>\n" +
                "        <dependency>\n" +
                "            <groupId>org.springframework.boot</groupId>\n" +
                "            <artifactId>spring-boot-starter-web</artifactId>\n" +
                "            <version>3.2.0</version>\n" +
                "            <scope>compile</scope>\n" +
                "        </dependency>\n" +
                "        <dependency>\n" +
                "            <groupId>org.junit.jupiter</groupId>\n" +
                "            <artifactId>junit-jupiter</artifactId>\n" +
                "            <version>5.10.0</version>\n" +
                "            <scope>test</scope>\n" +
                "        </dependency>\n" +
                "    </dependencies>\n" +
                "</project>";

        List<ParsedDep> deps = parserService.parsePomXml(pomXml);
        assertNotNull(deps);
        assertEquals(2, deps.size());

        ParsedDep springDep = deps.stream().filter(d -> d.getArtifactId().equals("spring-boot-starter-web")).findFirst().orElse(null);
        assertNotNull(springDep);
        assertEquals("org.springframework.boot", springDep.getGroupId());
        assertEquals("3.2.0", springDep.getVersion());
        assertEquals("compile", springDep.getScope());
        assertEquals("MAVEN", springDep.getPackageType());
        assertFalse(springDep.isDev());

        ParsedDep junitDep = deps.stream().filter(d -> d.getArtifactId().equals("junit-jupiter")).findFirst().orElse(null);
        assertNotNull(junitDep);
        assertEquals("test", junitDep.getScope());
    }

    @Test
    void testParsePackageJson() {
        String packageJson = "{\n" +
                "  \"name\": \"frontend-client\",\n" +
                "  \"version\": \"1.0.0\",\n" +
                "  \"dependencies\": {\n" +
                "    \"axios\": \"^1.6.0\",\n" +
                "    \"react\": \"~18.2.0\"\n" +
                "  },\n" +
                "  \"devDependencies\": {\n" +
                "    \"typescript\": \"^5.3.0\",\n" +
                "    \"vite\": \"5.0.0\"\n" +
                "  }\n" +
                "}";

        List<ParsedDep> deps = parserService.parsePackageJson(packageJson);
        assertNotNull(deps);
        assertEquals(4, deps.size());

        ParsedDep axios = deps.stream().filter(d -> d.getArtifactId().equals("axios")).findFirst().orElse(null);
        assertNotNull(axios);
        assertEquals("1.6.0", axios.getVersion());
        assertEquals("runtime", axios.getScope());
        assertFalse(axios.isDev());

        ParsedDep ts = deps.stream().filter(d -> d.getArtifactId().equals("typescript")).findFirst().orElse(null);
        assertNotNull(ts);
        assertEquals("5.3.0", ts.getVersion());
        assertEquals("dev", ts.getScope());
        assertTrue(ts.isDev());
    }
}

