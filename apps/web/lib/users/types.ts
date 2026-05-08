/**
 * TypeScript mirror of backend UserStubDto.
 * Source of truth: backend/app/src/main/java/com/drshoes/app/user/dto/UserStubDto.java
 * Used for assignee dropdowns in the admin UI.
 */

export interface UserStubDto {
  id: string;
  fullName: string;
  role: "OWNER" | "EMPLOYEE";
}
