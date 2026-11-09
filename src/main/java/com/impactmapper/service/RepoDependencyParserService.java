package com.impactmapper.service;

import com.impactmapper.dto.ParsedDep;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.w3c.dom.*;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.ByteArrayInputStream;
import java.util.*;

@Service
public class RepoDependencyParserService {

    private final ObjectMapper objectMapper = new ObjectMapper();

    public List<ParsedDep> parsePomXml(String content) {
        List<ParsedDep> dependencies = new ArrayList<>();
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            DocumentBuilder builder = factory.newDocumentBuilder();
            Document doc = builder.parse(new ByteArrayInputStream(content.getBytes()));
            doc.getDocumentElement().normalize();

            NodeList nList = doc.getElementsByTagName("dependency");
            for (int i = 0; i < nList.getLength(); i++) {
                Node node = nList.item(i);
                if (node.getNodeType() == Node.ELEMENT_NODE) {
                    Element element = (Element) node;
                    
                    // Check if this dependency is inside <dependencyManagement>
                    Node parent = node.getParentNode();
                    if (parent != null && parent.getNodeName().equals("dependencies")) {
                        Node grandParent = parent.getParentNode();
                        if (grandParent != null && grandParent.getNodeName().equals("dependencyManagement")) {
                            continue; // Skip dependencyManagement for now as it doesn't represent an active dependency
                        }
                    }

                    String groupId = getTagValue("groupId", element);
                    String artifactId = getTagValue("artifactId", element);
                    String version = getTagValue("version", element);
                    String scope = getTagValue("scope", element);

                    if (version == null || version.startsWith("$")) {
                        version = "RESOLVED_AT_BUILD_TIME";
                    }
                    if (scope == null) scope = "compile";

                    dependencies.add(ParsedDep.builder()
                            .groupId(groupId)
                            .artifactId(artifactId)
                            .version(version)
                            .scope(scope)
                            .isDev(false)
                            .packageType("MAVEN")
                            .build());
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return dependencies;
    }

    public List<ParsedDep> parsePackageJson(String content) {
        List<ParsedDep> dependencies = new ArrayList<>();
        try {
            JsonNode root = objectMapper.readTree(content);
            
            // Regular dependencies
            if (root.has("dependencies")) {
                JsonNode deps = root.get("dependencies");
                deps.fields().forEachRemaining(entry -> {
                    dependencies.add(ParsedDep.builder()
                            .groupId("npm")
                            .artifactId(entry.getKey())
                            .version(cleanNpmVersion(entry.getValue().asText()))
                            .scope("runtime")
                            .isDev(false)
                            .packageType("NPM")
                            .build());
                });
            }

            // Dev dependencies
            if (root.has("devDependencies")) {
                JsonNode devDeps = root.get("devDependencies");
                devDeps.fields().forEachRemaining(entry -> {
                    dependencies.add(ParsedDep.builder()
                            .groupId("npm")
                            .artifactId(entry.getKey())
                            .version(cleanNpmVersion(entry.getValue().asText()))
                            .scope("dev")
                            .isDev(true)
                            .packageType("NPM")
                            .build());
                });
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return dependencies;
    }

    private String getTagValue(String tag, Element element) {
        NodeList nlList = element.getElementsByTagName(tag).item(0) != null ? element.getElementsByTagName(tag).item(0).getChildNodes() : null;
        if (nlList == null) return null;
        Node nValue = (Node) nlList.item(0);
        return nValue != null ? nValue.getNodeValue() : null;
    }

    private String cleanNpmVersion(String version) {
        if (version == null) return "unknown";
        return version.replaceAll("[\\^~]", "");
    }
}
