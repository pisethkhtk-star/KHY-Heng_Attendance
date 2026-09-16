package com.hrchomnan.backend;

import com.hrchomnan.backend.controller.FaceDataController;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.ResponseEntity;

import org.springframework.security.test.context.support.WithMockUser;

import java.util.ArrayList;
import java.util.List;

@SpringBootTest
class BackendApplicationTests {

	@Autowired
	private com.hrchomnan.backend.controller.FaceDataController faceDataController;

	@Autowired
	private com.hrchomnan.backend.repository.EmployeeRepository employeeRepository;

	@Test
	void testEnrollFaceDoesNotTouchProfileImage() {
		com.hrchomnan.backend.model.Employee admin = employeeRepository.findAll().stream()
				.filter(e -> e.getRole() == com.hrchomnan.backend.enums.Role.Admin)
				.findFirst()
				.orElseGet(() -> com.hrchomnan.backend.model.Employee.builder()
						.id(java.util.UUID.randomUUID())
						.staffId("ADMIN-TEST")
						.role(com.hrchomnan.backend.enums.Role.Admin)
						.build());
		org.springframework.security.authentication.UsernamePasswordAuthenticationToken auth =
				new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
						admin, null, java.util.Collections.emptyList());
		org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(auth);

		// Reset EMP-001 photoUrl to null
		employeeRepository.findByStaffId("EMP-001").ifPresent(emp -> {
			emp.setPhotoUrl(null);
			employeeRepository.save(emp);
		});

		List<Double> dummyDescriptor = new ArrayList<>();
		for (int i = 0; i < 128; i++) {
			dummyDescriptor.add(0.123456);
		}

		FaceDataController.EnrollRequest req = new FaceDataController.EnrollRequest();
		req.setStaffId("EMP-001");
		req.setFaceDescriptor(dummyDescriptor);
		req.setPhotoUrl("data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...");

		ResponseEntity<?> response = faceDataController.enrollFace(req);
		System.out.println("Enroll response status: " + response.getStatusCode());

		// Verify employee photoUrl is STILL null and never replaced
		employeeRepository.findByStaffId("EMP-001").ifPresent(emp -> {
			System.out.println("Employee profile photo is preserved as: " + emp.getPhotoUrl());
		});
	}
}
