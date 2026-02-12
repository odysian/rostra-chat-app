# Rostra Test Plan

## Test Organization
```
tests/
├── conftest.py              # shared fixtures, test db setup, rate limit config
├── factories.py             # factory fixtures for users, rooms, messages
├── test_auth.py             # register, login, refresh, rate limiting
├── test_rooms.py            # create, list, get, join, leave
├── test_messages.py         # send, get history, access control
└── test_health.py           # service health and operational checks
```

## Implementation Rules for Cursor

When implementing these tests:

1. **Setup:**
   - Use existing test database setup in conftest.py
   - Create factory fixtures in tests/factories.py:
     * `create_user(email, username, password)` → returns user with tokens
     * `create_room(creator_token, name)` → returns room object
     * `create_message(user_token, room_id, content)` → returns message
   - All tests use database transactions that rollback after each test
   - Rate limiting disabled/very high for all tests EXCEPT specific rate limit tests

2. **Test Structure:**
   - Each test case gets its own test function
   - Use descriptive names: `test_create_room_returns_422_if_name_too_short`
   - Follow Arrange-Act-Assert pattern (setup → action → assertion)
   - Every test must assert BOTH status code AND response body content
   - DO NOT just check status codes - verify the actual data returned

3. **Assertions:**
   - Check status codes
   - Check response structure (has expected fields)
   - Check response values (correct user_id, room_id, content, etc)
   - For error cases, check error message is helpful
   - For list endpoints, check array length and content

4. **Critical Security Tests:**
   - `test_cannot_access_messages_from_room_not_member`
   - `test_cannot_send_message_to_room_not_member`
   - `test_cannot_access_room_details_if_not_member`

   These must verify 403 Forbidden, not 404 Not Found

5. **DO NOT:**
   - Mock the database
   - Test implementation details
   - Add tests not in this plan
   - Skip error case assertions

---

## Validation Rules (Reference)

- **Room name:** min 3 chars, max 50 chars
- **Message content:** min 1 char (after trim), max 1000 chars
- **Rate limiting:** Register and login only (disabled in tests except specific tests)

---

## Test Cases

### POST /api/auth/register

**Happy Path:**
- `test_register_with_valid_data_returns_201_and_tokens`
  - Valid registration returns 201
  - Response includes user object (id, email, username)
  - Response includes access_token and refresh_token
  - Password is hashed in database (not plaintext)
  - Email is normalized to lowercase

- `test_user_can_login_immediately_after_registration`
  - Register new user
  - Login with same credentials returns 200

**Error Cases:**
- `test_register_with_invalid_email_returns_422`
  - Email without @ symbol
  - Email without domain
  - Assert error message mentions invalid email

- `test_register_with_short_password_returns_422`
  - Password below minimum length
  - Assert error message mentions password requirements

- `test_register_with_existing_email_returns_409`
  - Create user with email
  - Try to register again with same email
  - Assert error message mentions email already exists

- `test_register_with_empty_username_returns_422`
  - Username is empty string or null
  - Assert error message mentions username required

- `test_register_with_missing_fields_returns_422`
  - Missing email field
  - Missing password field
  - Missing username field

**Edge Cases:**
- `test_register_normalizes_email_to_lowercase`
  - Register with "USER@EMAIL.COM"
  - Verify stored email is "user@email.com"

- `test_register_trims_username_whitespace`
  - Register with "  username  "
  - Verify stored username is "username"

- `test_register_with_username_at_min_length`
  - Username exactly 3 characters
  - Should succeed

- `test_register_with_username_at_max_length`
  - Username exactly 50 characters
  - Should succeed

- `test_register_with_special_characters_in_username`
  - Username with emoji, unicode
  - Should succeed (or fail if you don't allow it)

**Rate Limiting:**
- `test_register_rate_limit_returns_429`
  - Set temporary low rate limit (2/hour)
  - Make 3 registration attempts
  - Assert 3rd returns 429

---

### POST /api/auth/login

**Happy Path:**
- `test_login_with_valid_credentials_returns_200_and_tokens`
  - Login returns 200
  - Response includes access_token and refresh_token
  - Response includes user object

- `test_login_is_case_insensitive_for_email`
  - Register with "user@email.com"
  - Login with "USER@EMAIL.COM"
  - Should succeed

- `test_access_token_is_valid_for_subsequent_requests`
  - Login and get access token
  - Use token to make authenticated request
  - Should succeed

**Error Cases:**
- `test_login_with_incorrect_password_returns_401`
  - Create user
  - Login with wrong password
  - Assert error message is generic (doesn't reveal if email exists)

- `test_login_with_nonexistent_email_returns_401`
  - Login with email that doesn't exist
  - Assert error message is generic (same as wrong password)

- `test_login_with_missing_credentials_returns_422`
  - Missing email
  - Missing password

- `test_login_with_empty_password_returns_401`
  - Email exists but password is empty string

**Rate Limiting:**
- `test_login_rate_limit_returns_429`
  - Set temporary low rate limit
  - Make multiple failed login attempts
  - Assert rate limit triggers

---

### POST /api/auth/refresh (if implemented)

**Happy Path:**
- `test_refresh_with_valid_token_returns_new_access_token`
  - Login to get refresh token
  - Use refresh token to get new access token
  - New access token works for authenticated requests

**Error Cases:**
- `test_refresh_with_invalid_token_returns_401`
- `test_refresh_with_expired_token_returns_401`
- `test_refresh_with_missing_token_returns_401`

---

### POST /api/rooms

**Happy Path:**
- `test_create_room_with_valid_name_returns_201`
  - Room created with name between 3-50 chars
  - Response includes room object (id, name, created_at, creator_id)
  - Creator is automatically a room member

- `test_creator_automatically_added_as_room_member`
  - Create room
  - Get room member list
  - Assert creator is in member list

- `test_room_appears_in_creator_room_list`
  - Create room
  - Get user's room list
  - Assert new room is in list

**Error Cases:**
- `test_create_room_without_auth_returns_401`
  - No token provided
  - Assert 401

- `test_create_room_with_empty_name_returns_422`
  - Room name is empty string
  - Assert error message

- `test_create_room_with_name_too_short_returns_422`
  - Room name is 1-2 characters
  - Assert error message mentions minimum length

- `test_create_room_with_name_too_long_returns_422`
  - Room name is 51+ characters
  - Assert error message mentions maximum length

- `test_create_room_with_only_whitespace_returns_422`
  - Room name is "   "
  - Should be rejected

**Edge Cases:**
- `test_create_room_with_emoji_and_unicode`
  - Room name includes emoji/unicode
  - Should succeed

- `test_create_room_trims_whitespace`
  - Room name is "  roomname  "
  - Verify stored name is "roomname"

- `test_create_room_with_name_at_min_length`
  - Room name exactly 3 characters
  - Should succeed

- `test_create_room_with_name_at_max_length`
  - Room name exactly 50 characters
  - Should succeed

- `test_create_multiple_rooms_with_different_names`
  - Create 3 rooms with different names
  - All should succeed
  - All should appear in user's room list

- `test_create_room_with_duplicate_name` (CLARIFY: allowed or 409?)
  - Create room with name "Test Room"
  - Create another room with name "Test Room"
  - What should happen?

---

### GET /api/rooms

**Happy Path:**
- `test_get_rooms_returns_all_user_rooms`
  - User is member of 3 rooms
  - GET /api/rooms returns all 3
  - Each room includes id, name, created_at

- `test_get_rooms_returns_empty_array_if_no_rooms`
  - User has joined no rooms
  - Returns 200 with empty array (not 404)

**Error Cases:**
- `test_get_rooms_without_auth_returns_401`

---

### GET /api/rooms/:id

**Happy Path:**
- `test_get_room_details_returns_room_and_members`
  - User is room member
  - Response includes room details
  - Response includes member list

**Error Cases:**
- `test_get_room_without_auth_returns_401`

- `test_get_room_not_member_returns_403`
  - User A creates room
  - User B (not member) tries to get room details
  - Assert 403 Forbidden (CRITICAL: not 404)

- `test_get_nonexistent_room_returns_404`

---

### POST /api/rooms/:id/join

**Happy Path:**
- `test_join_room_returns_200_and_adds_membership`
  - User A creates room
  - User B joins room
  - User B appears in member list

- `test_after_joining_room_appears_in_user_room_list`
  - User joins room
  - GET /api/rooms shows room in list

- `test_after_joining_user_can_send_messages`
  - User joins room
  - User can POST message to room

**Error Cases:**
- `test_join_room_without_auth_returns_401`

- `test_join_nonexistent_room_returns_404`

- `test_join_room_already_member_returns_409`
  - User joins room
  - User tries to join again
  - Assert 409 Conflict

---

### POST /api/rooms/:id/leave (if implemented)

**Happy Path:**
- `test_leave_room_returns_200_and_removes_membership`
  - User leaves room
  - User no longer in member list

- `test_after_leaving_room_not_in_user_room_list`
  - User leaves room
  - GET /api/rooms does not show room

- `test_after_leaving_user_cannot_send_messages`
  - User leaves room
  - POST message returns 403

**Error Cases:**
- `test_leave_room_without_auth_returns_401`

- `test_leave_nonexistent_room_returns_404`

- `test_leave_room_not_member_returns_400`
  - User tries to leave room they're not in

**Edge Cases:**
- `test_last_user_leaving_room` (does room persist or get deleted?)
- `test_creator_leaving_own_room` (allowed?)

---

### Cursor Utilities (`backend/tests/test_cursor.py`)

**Happy Path:**
- `test_encode_decode_roundtrip_preserves_values`
  - Encoding and decoding a cursor preserves timestamp and ID

- `test_encode_with_microseconds_precision`
  - Encoding preserves microsecond precision in timestamp

**Error Cases:**
- `test_decode_invalid_base64_raises_value_error`
  - Decoding invalid base64 raises ValueError

- `test_decode_invalid_json_raises_value_error`
  - Decoding malformed JSON raises ValueError

- `test_decode_missing_fields_raises_value_error`
  - Decoding JSON missing required fields raises ValueError

- `test_decode_invalid_timestamp_format_raises_value_error`
  - Decoding invalid ISO timestamp raises ValueError

---

### GET /api/rooms/:id/messages

**Note:** This endpoint now returns `PaginatedMessages` response with `messages` array and `next_cursor` field. All existing tests have been updated to expect this format.

**Happy Path:**
- `test_get_messages_returns_paginated_response`
  - GET returns PaginatedMessages with messages array and next_cursor field

- `test_get_messages_returns_room_history`
  - Room has 5 messages
  - GET returns all 5 messages in the messages array
  - Messages ordered by created_at descending (newest first)

- `test_get_messages_includes_sender_info`
  - Each message includes:
    * id, content, created_at
    * sender_id, sender_username

- `test_get_messages_from_empty_room_returns_empty_array`
  - Room has no messages
  - Returns 200 with empty messages array (not 404)

**Pagination Behavior:**
- `test_get_messages_without_cursor_returns_recent_messages`
  - Fetching without cursor returns most recent messages

- `test_get_messages_with_cursor_returns_older_messages`
  - Fetching with cursor returns messages older than cursor position

- `test_get_messages_next_cursor_null_at_end_of_history`
  - next_cursor is null when no more messages exist

- `test_get_messages_next_cursor_present_when_more_exist`
  - next_cursor is present when more messages exist

- `test_get_messages_respects_limit_parameter`
  - Limit parameter controls number of messages returned (1-100)

- `test_get_messages_with_same_timestamp_orders_by_id`
  - Messages with same timestamp ordered by ID (tiebreaker)

- `test_pagination_stable_with_concurrent_inserts`
  - Pagination remains stable when new messages are inserted during pagination

**Error Cases:**
- `test_get_messages_without_auth_returns_401`

- `test_get_messages_not_room_member_returns_403`
  - User A creates room with messages
  - User B (not member) tries to get messages
  - Assert 403 Forbidden (CRITICAL SECURITY TEST)

- `test_get_messages_nonexistent_room_returns_404`

- `test_get_messages_invalid_cursor_returns_400`
  - Invalid cursor format returns 400 with error detail

- `test_get_messages_limit_too_small_returns_422`
  - Limit < 1 returns 422

- `test_get_messages_limit_too_large_returns_422`
  - Limit > 100 returns 422

**Edge Cases:**
- `test_get_messages_with_emoji_and_unicode`
  - Messages contain emoji/unicode
  - All render correctly

- `test_get_messages_with_newlines`
  - Messages contain newlines/paragraphs
  - Content preserved correctly

---

### POST /api/rooms/:id/messages

**Happy Path:**
- `test_send_message_returns_201_and_message_object`
  - User sends message
  - Response includes message (id, content, sender_id, created_at)

- `test_sent_message_appears_in_room_history`
  - User sends message
  - GET /api/rooms/:id/messages includes new message

- `test_send_message_trims_whitespace`
  - User sends "  message  "
  - Stored content is "message"

**Error Cases:**
- `test_send_message_without_auth_returns_401`

- `test_send_message_not_room_member_returns_403`
  - User A creates room
  - User B (not member) tries to send message
  - Assert 403 Forbidden (CRITICAL SECURITY TEST)

- `test_send_message_with_empty_content_returns_422`
  - Message content is empty string
  - Assert error message

- `test_send_message_with_only_whitespace_returns_422`
  - Message content is "   "
  - Should be rejected after trimming

- `test_send_message_too_short_returns_422`
  - Message is 0 characters after trim
  - Assert error about minimum length

- `test_send_message_too_long_returns_422`
  - Message is 1001+ characters
  - Assert error about maximum length

- `test_send_message_to_nonexistent_room_returns_404`

**Edge Cases:**
- `test_send_message_with_emoji_and_unicode`
  - Message includes emoji/unicode
  - Should succeed and render correctly

- `test_send_message_with_special_characters`
  - Message includes < > & " '
  - Should be sanitized for XSS

- `test_send_message_with_newlines`
  - Message includes \n characters
  - Should preserve formatting

- `test_send_message_at_min_length`
  - Message exactly 1 character after trim
  - Should succeed

- `test_send_message_at_max_length`
  - Message exactly 1000 characters
  - Should succeed

- `test_send_rapid_successive_messages`
  - User sends 5 messages quickly
  - All should succeed (no rate limit yet)

**Security:**
- `test_message_content_is_sanitized_for_xss`
  - Send message with <script>alert('xss')</script>
  - Verify stored content has < > converted to entities
  - GET messages returns sanitized content

---

### GET /api/health/db

**Happy Path:**
- `test_db_health_returns_pool_metrics_and_status`
  - Returns 200
  - Response includes `pool_size`, `checked_out`, `overflow`, and `status`
  - Metric fields are integers
  - `status` is either `healthy` or `degraded`

---

## Rate Limit Configuration

Add to `conftest.py`:
```python
@pytest.fixture(scope="session", autouse=True)
def disable_rate_limiting():
    """Set rate limits very high for tests"""
    os.environ["RATE_LIMIT_REGISTER"] = "1000/hour"
    os.environ["RATE_LIMIT_LOGIN"] = "1000/hour"
    yield
```

For specific rate limit tests, use a context manager or temporary env var override.

---

## After Implementation

**Review Checklist:**
1. Do tests actually test what the test plan specified?
2. Are assertions checking response body, not just status codes?
3. Are security tests verifying 403 (not 404) for unauthorized access?
4. Are test names descriptive enough to understand failures?
5. Do tests use factories/fixtures instead of hardcoded data?

**Verification Steps:**
1. Run tests - all should pass
2. Introduce a bug (remove an auth check) - tests should catch it
3. Check test coverage for critical paths (auth, message access control)
