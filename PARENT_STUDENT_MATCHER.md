# Parent-Student Matcher Guide

This document explains how parent-to-student matching works in the backend.

## Source File

Main logic lives in:
- backend/src/services/parent.service.js

Core functions:
- parentMatchesStudent(studentDetails, input)
- findStudentsByParentInfo(instituteId, info)

## Input Used For Matching

From the parent modal/request:
- first_name
- last_name
- phone
- cnic
- email

The service builds full_name as:
- first_name + " " + last_name

## Data Used From Student Record

From details.studentDetails:
- guardians[] (new structure)
  - guardian.name
  - guardian.phone
  - guardian.cnic
  - guardian.email
- legacy fields (old structure fallback)
  - father_name, mother_name, guardian_name
  - father_phone, mother_phone, guardian_phone
  - father_cnic, cnic
  - guardian_email

## Normalization Rules

1. normalize(v)
- trims spaces

2. normalizeLower(v)
- trims + lowercases

3. digitsOnly(v)
- removes all non-digit characters
- example: 03xx-xxxxxxx -> 03xxxxxxxxx

## Name Match (tokenized)

Function: tokenizedNameMatch(candidate, query)

Behavior:
- query is split into tokens by space
- every token must exist in candidate (case-insensitive)

Examples:
- query: "hassan raza"
- candidate: "Hassan Raza Attari"
- result: match (true)

## Phone Match

Function: phoneLikeMatch(left, right)

Behavior:
- exact digit match passes
- if exact fails, compares last 10 digits
- handles formats like:
  - 03xxxxxxxxx
  - 92xxxxxxxxxx

## Final Matching Decision

Inside parentMatchesStudent:

1. Build candidate arrays from guardians + legacy fields
2. Compute:
- matchName
- matchPhone
- matchCnic
- matchEmail

3. Decision rule:
- If any identifier was provided (phone/cnic/email):
  - return (matchPhone OR matchCnic OR matchEmail)
- Else (only name provided):
  - return matchName

This avoids strict false negatives when name spelling/order differs.

## End-to-End Flow

1. findStudentsByParentInfo loads active students of institute
2. For each student, it calls parentMatchesStudent(student.details.studentDetails, input)
3. Matched students are transformed by mapLinkedStudent
4. Response returns compact student list:
- id, name, registration_no, class/section, roll_no

## Important Note

Current identifier logic is OR-based when identifier fields are present.
That means if phone OR cnic OR email matches, student is considered matched.
This is intentional for flexible search and to reduce misses.

If stricter matching is needed later, rule can be changed to weighted or AND-based logic.
