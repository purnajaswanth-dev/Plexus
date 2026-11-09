package com.impactmapper.parser;

import com.impactmapper.dto.ParsedDep;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.w3c.dom.*;

import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.*;

@Component
@Slf4j
public class MavenPomParser implements ManifestParser {

    @Override
    public boolean supports(String filePath) {
        if (filePath == null) return false;
        String normalized = filePath.replace('\\', '/').toLowerCase();
        return normalized.endsWith("pom.xml");
    }

    @Override
    public String getEcosystem() {
        return "MAVEN";
    }

    @Override
    public ManifestParseResult parse(String filePath, String content) {
        if (content == null || content.isBlank()) {
            return ManifestParseResult.failure(filePath, getEcosystem(), "pom.xml is empty or blank");
        }

        List<ParsedDep> dependencies = new ArrayList<>();
        List<String> diagnostics = new ArrayList<>();
        Map<String, String> properties = new HashMap<>();

        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            // Secure XML parsing against XXE
            try {
                factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
                factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            } catch (Exception ignored) {}

            DocumentBuilder builder = factory.newDocumentBuilder();
            Document doc = builder.parse(new ByteArrayInputStream(content.getBytes(StandardCharsets.UTF_8)));
            doc.getDocumentElement().normalize();

            // 1. Extract Maven Properties for variable interpolation (e.g. ${springdoc.version})
            NodeList propertiesNodes = doc.getElementsByTagName("properties");
            for (int i = 0; i < propertiesNodes.getLength(); i++) {
                Node propContainer = propertiesNodes.item(i);
                if (propContainer.getNodeType() == Node.ELEMENT_NODE) {
                    NodeList propChildren = propContainer.getChildNodes();
                    for (int j = 0; j < propChildren.getLength(); j++) {
                        Node child = propChildren.item(j);
                        if (child.getNodeType() == Node.ELEMENT_NODE) {
                            String propKey = child.getNodeName();
                            String propVal = child.getTextContent() != null ? child.getTextContent().trim() : "";
                            properties.put(propKey, propVal);
                        }
                    }
                }
            }

            // Also capture parent version if specified
            NodeList parentNodes = doc.getElementsByTagName("parent");
            if (parentNodes.getLength() > 0) {
                Node pNode = parentNodes.item(0);
                if (pNode.getNodeType() == Node.ELEMENT_NODE) {
                    Element pEl = (Element) pNode;
                    String parentVer = getTagValue("version", pEl);
                    if (parentVer != null && !parentVer.isBlank()) {
                        properties.put("project.version", parentVer);
                        properties.put("version", parentVer);
                    }
                }
            }

            // 2. Parse Declared Dependencies
            NodeList nList = doc.getElementsByTagName("dependency");
            for (int i = 0; i < nList.getLength(); i++) {
                Node node = nList.item(i);
                if (node.getNodeType() == Node.ELEMENT_NODE) {
                    Element element = (Element) node;

                    // Skip dependencies inside <dependencyManagement>
                    Node parent = node.getParentNode();
                    if (parent != null && parent.getNodeName().equals("dependencies")) {
                        Node grandParent = parent.getParentNode();
                        if (grandParent != null && grandParent.getNodeName().equals("dependencyManagement")) {
                            continue; // Skip managed dependency definition
                        }
                    }

                    String groupId = getTagValue("groupId", element);
                    String artifactId = getTagValue("artifactId", element);
                    String rawVersion = getTagValue("version", element);
                    String scope = getTagValue("scope", element);

                    if (groupId == null || artifactId == null) {
                        continue;
                    }

                    // Resolve variable if version is ${property.name}
                    String version = resolveVersion(rawVersion, properties);

                    if (scope == null || scope.isBlank()) {
                        scope = "compile";
                    }

                    boolean isDev = "test".equalsIgnoreCase(scope);

                    dependencies.add(ParsedDep.builder()
                            .groupId(groupId.trim())
                            .artifactId(artifactId.trim())
                            .version(version)
                            .scope(scope.trim().toLowerCase())
                            .isDev(isDev)
                            .packageType("MAVEN")
                            .manifestPath(filePath)
                            .build());
                }
            }

            return ManifestParseResult.builder()
                    .manifestPath(filePath)
                    .ecosystem(getEcosystem())
                    .dependencies(dependencies)
                    .success(true)
                    .diagnostics(diagnostics)
                    .metadata(Map.of("propertiesResolved", properties.size(), "dependenciesCount", dependencies.size()))
                    .build();

        } catch (Exception e) {
            log.warn("Failed to parse Maven pom.xml at {}: {}", filePath, e.getMessage());
            return ManifestParseResult.failure(filePath, getEcosystem(), "XML parse error: " + e.getMessage());
        }
    }

    private String resolveVersion(String version, Map<String, String> properties) {
        if (version == null || version.isBlank()) {
            return "MANAGED_BY_PARENT";
        }
        String trimmed = version.trim();
        if (trimmed.startsWith("${") && trimmed.endsWith("}")) {
            String propName = trimmed.substring(2, trimmed.length() - 1);
            if (properties.containsKey(propName)) {
                return properties.get(propName);
            }
            return "RESOLVED_AT_BUILD_TIME";
        }
        return trimmed;
    }

    private String getTagValue(String tag, Element element) {
        NodeList nl = element.getElementsByTagName(tag);
        if (nl != null && nl.getLength() > 0) {
            Node n = nl.item(0);
            if (n != null) {
                return n.getTextContent();
            }
        }
        return null;
    }
}

