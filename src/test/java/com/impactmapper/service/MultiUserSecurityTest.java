package com.impactmapper.service;

import com.impactmapper.controller.ArchitectureController;
import com.impactmapper.controller.CodeCityController;
import com.impactmapper.controller.RepositoryController;
import com.impactmapper.dto.codecity.CityModelDTO;
import com.impactmapper.dto.codecity.EndpointDTO;
import com.impactmapper.entity.AppUser;
import com.impactmapper.entity.Repository;
import com.impactmapper.exception.RepoNotFoundException;
import com.impactmapper.repository.ArchitectureSnapshotRepository;
import com.impactmapper.repository.RepoDependencyRepository;
import com.impactmapper.repository.RepositoryRepository;
import com.impactmapper.security.UserPrincipal;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class MultiUserSecurityTest {

    private static final UUID USER_A_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID USER_B_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");

    @Mock
    private RepositoryRepository repositoryRepository;

    @Mock
    private RepoDependencyRepository dependencyRepository;

    @Mock
    private ArchitectureSnapshotRepository snapshotRepository;

    @Mock
    private CodeCityService codeCityService;

    @Mock
    private ArchitectureAnalysisService architectureAnalysisService;

    @Mock
    private HealthService healthService;

    @InjectMocks
    private CodeCityController codeCityController;

    @InjectMocks
    private ArchitectureController architectureController;

    @InjectMocks
    private RepositoryController repositoryController;

    private AppUser userA;
    private AppUser userB;
    private Repository repoA;
    private Repository repoB;

    @BeforeEach
    void setUp() {
        userA = AppUser.builder()
                .id(USER_A_ID)
                .supabaseUserId(USER_A_ID)
                .email("alice@codecity.dev")
                .displayName("Alice Engineer")
                .build();

        userB = AppUser.builder()
                .id(USER_B_ID)
                .supabaseUserId(USER_B_ID)
                .email("bob@codecity.dev")
                .displayName("Bob Architect")
                .build();

        repoA = Repository.builder()
                .id(101L)
                .owner(userA)
                .repoName("alice/order-service")
                .language("Java")
                .build();

        repoB = Repository.builder()
                .id(202L)
                .owner(userB)
                .repoName("bob/payment-gateway")
                .language("Java")
                .build();

        // Simulate User A as the authenticated principal in Spring SecurityContext
        UserPrincipal principalA = UserPrincipal.builder()
                .appUserId(USER_A_ID)
                .supabaseUserId(USER_A_ID)
                .email("alice@codecity.dev")
                .displayName("Alice Engineer")
                .build();

        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                principalA, null, principalA.getAuthorities()
        );
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("User A can successfully access their own CodeCity model")
    void testUserCanAccessOwnCityModel() {
        when(repositoryRepository.existsByIdAndOwnerId(101L, USER_A_ID)).thenReturn(true);
        when(codeCityService.getCityModel(101L)).thenReturn(CityModelDTO.builder().repositoryId(101L).build());

        ResponseEntity<CityModelDTO> response = codeCityController.getCityModel(101L);

        assertNotNull(response);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals(101L, response.getBody().getRepositoryId());
        verify(repositoryRepository).existsByIdAndOwnerId(101L, USER_A_ID);
    }

    @Test
    @DisplayName("IDOR Protection: User A attempting to access User B's City Model throws RepoNotFoundException")
    void testUserCannotAccessOtherUserCityModel_ThrowsNotFound() {
        when(repositoryRepository.existsByIdAndOwnerId(202L, USER_A_ID)).thenReturn(false);

        assertThrows(RepoNotFoundException.class, () -> {
            codeCityController.getCityModel(202L);
        });

        verify(codeCityService, never()).getCityModel(anyLong());
    }

    @Test
    @DisplayName("IDOR Protection: User A attempting to list User B's Endpoints throws RepoNotFoundException")
    void testUserCannotAccessOtherUserEndpoints_ThrowsNotFound() {
        when(repositoryRepository.existsByIdAndOwnerId(202L, USER_A_ID)).thenReturn(false);

        assertThrows(RepoNotFoundException.class, () -> {
            codeCityController.getEndpoints(202L);
        });

        verify(codeCityService, never()).getEndpoints(anyLong());
    }

    @Test
    @DisplayName("IDOR Protection: User A attempting to query User B's API Inventory throws RepoNotFoundException")
    void testUserCannotAccessOtherUserJourneys_ThrowsNotFound() {
        when(repositoryRepository.existsByIdAndOwnerId(202L, USER_A_ID)).thenReturn(false);

        assertThrows(RepoNotFoundException.class, () -> {
            codeCityController.getApis(202L, null, null, null, null, null);
        });

        verify(codeCityService, never()).getApis(anyLong(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("IDOR Protection: User A attempting to query User B's Architecture Snapshot throws RepoNotFoundException")
    void testUserCannotAccessOtherUserArchitecture_ThrowsNotFound() {
        when(repositoryRepository.existsByIdAndOwnerId(202L, USER_A_ID)).thenReturn(false);

        assertThrows(RepoNotFoundException.class, () -> {
            architectureController.getArchitecture(202L, 3);
        });

        verify(architectureAnalysisService, never()).getArchitectureGraph(anyLong(), anyInt());
    }

    @Test
    @DisplayName("Tenant Isolation: getAllRepositories only returns repositories owned by the authenticated user")
    void testGetAllRepositories_ReturnsOnlyUserRepos() {
        when(repositoryRepository.findByOwnerIdOrderByAddedAtDesc(USER_A_ID)).thenReturn(List.of(repoA));
        when(dependencyRepository.findByRepositoryIdIn(anySet())).thenReturn(Collections.emptyList());
        when(healthService.evaluateHealth(eq(repoA), anyList())).thenReturn(
                new HealthService.HealthReport(95, "A", Collections.emptyList())
        );

        List<Map<String, Object>> userRepos = repositoryController.getAllRepositories();

        assertNotNull(userRepos);
        assertEquals(1, userRepos.size());
        assertEquals("alice/order-service", userRepos.get(0).get("repoName"));
        verify(repositoryRepository).findByOwnerIdOrderByAddedAtDesc(USER_A_ID);
        verify(repositoryRepository, never()).findAllByOrderByAddedAtDesc();
    }

    @Test
    @DisplayName("IDOR Protection: getRepositoryDetail for another user's repo returns 404 Not Found")
    void testGetRepositoryDetail_OtherUserRepo_Returns404() {
        when(repositoryRepository.findByIdAndOwnerId(202L, USER_A_ID)).thenReturn(Optional.empty());

        ResponseEntity<Map<String, Object>> response = repositoryController.getRepositoryDetail(202L);

        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
        verify(dependencyRepository, never()).findByRepositoryId(202L);
    }

    @Test
    @DisplayName("Repository Detail: Returns 200 OK and serializes dependencies without lazy proxy errors")
    void testGetRepositoryDetail_Success_SerializesWithoutLazyErrors() throws Exception {
        when(repositoryRepository.findByIdAndOwnerId(101L, USER_A_ID)).thenReturn(Optional.of(repoA));
        com.impactmapper.entity.RepoDependency dep = com.impactmapper.entity.RepoDependency.builder()
                .id(1L)
                .repository(repoA)
                .groupId("org.springframework.boot")
                .artifactId("spring-boot-starter-web")
                .version("3.2.5")
                .scope("compile")
                .packageType("MAVEN")
                .build();
        when(dependencyRepository.findByRepositoryId(101L)).thenReturn(List.of(dep));
        when(healthService.evaluateHealth(eq(repoA), anyList())).thenReturn(
                new HealthService.HealthReport(95, "A", Collections.emptyList())
        );

        ResponseEntity<Map<String, Object>> response = repositoryController.getRepositoryDetail(101L);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertTrue(response.getBody().containsKey("repository"));
        assertTrue(response.getBody().containsKey("dependencies"));
        assertTrue(response.getBody().containsKey("allDependencies"));

        com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
        mapper.findAndRegisterModules();
        String json = mapper.writeValueAsString(response.getBody());

        assertNotNull(json);
        assertTrue(json.contains("alice/order-service"));
        assertTrue(json.contains("spring-boot-starter-web"));
    }

    @Test
    @DisplayName("IDOR Protection: deleteRepository for another user's repo returns 404 Not Found")
    void testDeleteRepository_OtherUserRepo_Returns404() {
        when(repositoryRepository.existsByIdAndOwnerId(202L, USER_A_ID)).thenReturn(false);

        ResponseEntity<Void> response = repositoryController.deleteRepository(202L);

        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
        verify(repositoryRepository, never()).deleteById(anyLong());
    }
}
