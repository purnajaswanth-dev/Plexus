package com.impactmapper.service;

import com.impactmapper.controller.CodeCityController;
import com.impactmapper.dto.codecity.*;
import com.impactmapper.entity.ArchitectureSnapshot;
import com.impactmapper.entity.Repository;
import com.impactmapper.repository.ArchitectureSnapshotRepository;
import com.impactmapper.repository.RepositoryRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.LocalDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CodeCityControllerTest {

    @Mock
    private CodeCityService codeCityService;

    @Mock
    private RepositoryRepository repositoryRepository;

    @Mock
    private ArchitectureSnapshotRepository snapshotRepository;

    @Mock
    private ArchitectureAnalysisService architectureAnalysisService;

    @InjectMocks
    private CodeCityController controller;

    private Repository repo;

    @BeforeEach
    void setUp() {
        repo = Repository.builder()
                .id(1L)
                .repoName("spring-projects/spring-petclinic")
                .language("Java")
                .build();
    }

    @Test
    void testGetRepositoryCities() {
        when(repositoryRepository.findAllByOrderByAddedAtDesc()).thenReturn(List.of(repo));
        ArchitectureSnapshot snap = ArchitectureSnapshot.builder()
                .id(10L)
                .status("ANALYZED")
                .totalComponents(45)
                .totalRelationships(52)
                .analyzedAt(LocalDateTime.now())
                .build();
        when(snapshotRepository.findTopByRepositoryIdOrderByAnalyzedAtDesc(1L)).thenReturn(Optional.of(snap));

        ResponseEntity<List<Map<String, Object>>> res = controller.getRepositoryCities();

        assertEquals(HttpStatus.OK, res.getStatusCode());
        assertNotNull(res.getBody());
        assertEquals(1, res.getBody().size());
        assertEquals(true, res.getBody().get(0).get("hasCity"));
        assertEquals(45, res.getBody().get(0).get("componentsCount"));
    }

    @Test
    void testGetCityModel() {
        CityModelDTO city = CityModelDTO.builder()
                .repositoryId(1L)
                .repositoryName("spring-projects/spring-petclinic")
                .districts(List.of(CityDistrictDTO.builder().name("Controller District").build()))
                .buildings(List.of(CityBuildingDTO.builder().name("OwnerController").build()))
                .build();

        when(codeCityService.getCityModel(1L)).thenReturn(city);

        ResponseEntity<CityModelDTO> res = controller.getCityModel(1L);

        assertEquals(HttpStatus.OK, res.getStatusCode());
        assertEquals(1, res.getBody().getDistricts().size());
        assertEquals("OwnerController", res.getBody().getBuildings().get(0).getName());
    }

    @Test
    void testGetEndpoints() {
        List<EndpointDTO> list = List.of(
                EndpointDTO.builder().httpMethod("GET").routePath("/owners").build(),
                EndpointDTO.builder().httpMethod("POST").routePath("/owners").build()
        );

        when(codeCityService.getEndpoints(1L)).thenReturn(list);

        ResponseEntity<List<EndpointDTO>> res = controller.getEndpoints(1L);

        assertEquals(HttpStatus.OK, res.getStatusCode());
        assertEquals(2, res.getBody().size());
    }

    @Test
    void testGetExecutionPath() {
        ExecutionPathDTO path = ExecutionPathDTO.builder()
                .endpointId(5L)
                .httpMethod("GET")
                .routePath("/owners")
                .totalSteps(3)
                .build();

        when(codeCityService.getStaticExecutionPath(5L)).thenReturn(path);

        ResponseEntity<ExecutionPathDTO> res = controller.getExecutionPath(1L, 5L);

        assertEquals(HttpStatus.OK, res.getStatusCode());
        assertEquals(3, res.getBody().getTotalSteps());
    }
}

