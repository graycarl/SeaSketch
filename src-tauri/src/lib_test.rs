#[cfg(test)]
mod tests {
    use super::super::*;
    use tempfile::TempDir;
    use std::fs;

    #[test]
    fn test_ensure_parent_creates_parent_directories() {
        let temp_dir = TempDir::new().unwrap();
        let nested_path = temp_dir.path().join("level1").join("level2").join("file.txt");
        
        assert!(!nested_path.parent().unwrap().exists());
        
        ensure_parent(&nested_path).unwrap();
        
        assert!(nested_path.parent().unwrap().exists());
    }

    #[test]
    fn test_ensure_dir_creates_directory() {
        let temp_dir = TempDir::new().unwrap();
        let new_dir = temp_dir.path().join("new_directory");
        
        assert!(!new_dir.exists());
        
        ensure_dir(&new_dir).unwrap();
        
        assert!(new_dir.exists());
        assert!(new_dir.is_dir());
    }

    #[test]
    fn test_parse_chat_empty_content() {
        let content = "";
        let messages = parse_chat(content);
        assert!(messages.is_empty());
    }

    #[test]
    fn test_parse_chat_single_message() {
        let content = r#"<!-- message: {"id":"msg-1","role":"user","timestamp":"2024-01-01T00:00:00Z"} -->
Hello, this is a test message"#;
        
        let messages = parse_chat(content);
        
        assert_eq!(messages.len(), 1);
        assert_eq!(messages[0].id, "msg-1");
        assert_eq!(messages[0].role, "user");
        assert_eq!(messages[0].content, "Hello, this is a test message");
    }

    #[test]
    fn test_parse_chat_multiple_messages() {
        let content = r#"<!-- message: {"id":"msg-1","role":"user","timestamp":"2024-01-01T00:00:00Z"} -->
User message

<!-- message: {"id":"msg-2","role":"assistant","timestamp":"2024-01-01T00:00:01Z"} -->
Assistant response"#;
        
        let messages = parse_chat(content);
        
        assert_eq!(messages.len(), 2);
        assert_eq!(messages[0].id, "msg-1");
        assert_eq!(messages[0].role, "user");
        assert_eq!(messages[1].id, "msg-2");
        assert_eq!(messages[1].role, "assistant");
    }

    #[test]
    fn test_parse_chat_with_attachments() {
        let content = r#"<!-- message: {"id":"msg-1","role":"user","timestamp":"2024-01-01T00:00:00Z","attachments":["file1.txt","file2.png"]} -->
Message with attachments"#;
        
        let messages = parse_chat(content);
        
        assert_eq!(messages.len(), 1);
        assert_eq!(messages[0].attachments, Some(vec!["file1.txt".to_string(), "file2.png".to_string()]));
    }

    #[test]
    fn test_parse_chat_with_applied_mermaid() {
        let content = r#"<!-- message: {"id":"msg-1","role":"assistant","timestamp":"2024-01-01T00:00:00Z","applied_mermaid":true} -->
graph TD
    A --> B"#;
        
        let messages = parse_chat(content);
        
        assert_eq!(messages.len(), 1);
        assert_eq!(messages[0].applied_mermaid, Some(true));
    }

    #[test]
    fn test_parse_chat_multiline_content() {
        let content = r#"<!-- message: {"id":"msg-1","role":"user","timestamp":"2024-01-01T00:00:00Z"} -->
Line 1
Line 2
Line 3"#;
        
        let messages = parse_chat(content);
        
        assert_eq!(messages.len(), 1);
        assert_eq!(messages[0].content, "Line 1\nLine 2\nLine 3");
    }

    #[test]
    fn test_format_message_basic() {
        let message = ChatMessage {
            id: "msg-1".to_string(),
            role: "user".to_string(),
            content: "Hello".to_string(),
            timestamp: "2024-01-01T00:00:00Z".to_string(),
            attachments: None,
            applied_mermaid: None,
        };
        
        let formatted = format_message(&message).unwrap();
        
        assert!(formatted.contains("<!-- message:"));
        assert!(formatted.contains("msg-1"));
        assert!(formatted.contains("Hello"));
    }

    #[test]
    fn test_format_message_with_attachments() {
        let message = ChatMessage {
            id: "msg-1".to_string(),
            role: "user".to_string(),
            content: "Hello".to_string(),
            timestamp: "2024-01-01T00:00:00Z".to_string(),
            attachments: Some(vec!["file1.txt".to_string()]),
            applied_mermaid: None,
        };
        
        let formatted = format_message(&message).unwrap();
        
        assert!(formatted.contains("file1.txt"));
    }

    #[test]
    fn test_app_state_default() {
        let state = AppState::default();
        
        assert_eq!(state.folders.len(), 1);
        assert_eq!(state.folders[0].name, "Default Folder");
        assert_eq!(state.folders[0].files.len(), 1);
        assert_eq!(state.folders[0].files[0].name, "New Diagram");
        assert!(state.current_folder_id.is_some());
        assert!(state.current_file_id.is_some());
    }

    #[test]
    fn test_serialization_roundtrip() {
        let original = AppState::default();
        
        let json = serde_json::to_string(&original).unwrap();
        let deserialized: AppState = serde_json::from_str(&json).unwrap();
        
        assert_eq!(deserialized.folders.len(), original.folders.len());
        assert_eq!(deserialized.folders[0].name, original.folders[0].name);
        assert_eq!(deserialized.current_folder_id, original.current_folder_id);
    }

    #[test]
    fn test_chat_meta_serialization() {
        let meta = ChatMeta {
            id: "test-id".to_string(),
            role: "assistant".to_string(),
            timestamp: "2024-01-01T00:00:00Z".to_string(),
            attachments: Some(vec!["file.txt".to_string()]),
            applied_mermaid: Some(true),
        };
        
        let json = serde_json::to_string(&meta).unwrap();
        assert!(json.contains("test-id"));
        assert!(json.contains("assistant"));
        assert!(json.contains("file.txt"));
        assert!(json.contains("true"));
    }

    #[test]
    fn test_attachment_meta_size() {
        let meta = AttachmentMeta {
            id: "att-1".to_string(),
            name: "test.txt".to_string(),
            filename: "test.txt".to_string(),
            size: 1024,
        };
        
        assert_eq!(meta.size, 1024);
    }

    // Integration test for file operations
    #[test]
    fn test_file_operations_in_temp_dir() {
        let temp_dir = TempDir::new().unwrap();
        let test_file = temp_dir.path().join("test.txt");
        
        // Write content
        fs::write(&test_file, "Hello, World!").unwrap();
        
        // Read content back
        let content = fs::read_to_string(&test_file).unwrap();
        assert_eq!(content, "Hello, World!");
        
        // Check file metadata
        let metadata = fs::metadata(&test_file).unwrap();
        assert!(metadata.is_file());
        assert_eq!(metadata.len(), 13); // "Hello, World!".len()
    }

    #[test]
    fn test_directory_creation_chain() {
        let temp_dir = TempDir::new().unwrap();
        let deep_path = temp_dir.path()
            .join("a")
            .join("b")
            .join("c")
            .join("deep.txt");
        
        // Create all parent directories
        ensure_parent(&deep_path).unwrap();
        
        // Write file
        fs::write(&deep_path, "deep content").unwrap();
        
        // Verify
        assert!(deep_path.exists());
        let content = fs::read_to_string(&deep_path).unwrap();
        assert_eq!(content, "deep content");
    }

    // Settings serialization tests
    #[test]
    fn test_ai_settings_default() {
        let settings = AISettings {
            ai_provider: "openai".to_string(),
            openai_api_key: "".to_string(),
            openai_api_host: "https://api.openai.com".to_string(),
            openai_model: Some("gpt-4o".to_string()),
            gemini_api_key: "".to_string(),
            gemini_oauth: None,
            gemini_model: Some("gemini-3-flash-preview".to_string()),
        };
        
        assert_eq!(settings.ai_provider, "openai");
        assert_eq!(settings.openai_api_host, "https://api.openai.com");
    }

    #[test]
    fn test_ai_settings_serialization() {
        let settings = AISettings {
            ai_provider: "gemini".to_string(),
            openai_api_key: "sk-test".to_string(),
            openai_api_host: "https://custom.api.com".to_string(),
            openai_model: Some("gpt-4".to_string()),
            gemini_api_key: "gemini-key".to_string(),
            gemini_oauth: None,
            gemini_model: Some("gemini-pro".to_string()),
        };
        
        let json = serde_json::to_string(&settings).unwrap();
        assert!(json.contains("gemini"));
        assert!(json.contains("sk-test"));
        
        let deserialized: AISettings = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.ai_provider, "gemini");
        assert_eq!(deserialized.openai_api_key, "sk-test");
    }

    #[test]
    fn test_ai_settings_with_oauth() {
        let oauth = oauth::OAuthCredentials {
            access_token: "access123".to_string(),
            refresh_token: "refresh456".to_string(),
            expires_at: 1234567890,
            project_id: "project-abc".to_string(),
            email: Some("test@example.com".to_string()),
        };
        
        let settings = AISettings {
            ai_provider: "gemini".to_string(),
            openai_api_key: "".to_string(),
            openai_api_host: "https://api.openai.com".to_string(),
            openai_model: Some("gpt-4o".to_string()),
            gemini_api_key: "".to_string(),
            gemini_oauth: Some(oauth),
            gemini_model: Some("gemini-3-flash-preview".to_string()),
        };
        
        let json = serde_json::to_string(&settings).unwrap();
        assert!(json.contains("access123"));
        assert!(json.contains("project-abc"));
        
        let deserialized: AISettings = serde_json::from_str(&json).unwrap();
        assert!(deserialized.gemini_oauth.is_some());
        let oauth = deserialized.gemini_oauth.unwrap();
        assert_eq!(oauth.access_token, "access123");
        assert_eq!(oauth.email, Some("test@example.com".to_string()));
    }

    // FileNode and FolderNode tests
    #[test]
    fn test_filenode_with_snapshots() {
        let file = FileNode {
            id: "file-1".to_string(),
            name: "test.mmd".to_string(),
            content: "graph TD\nA-->B".to_string(),
            preview_background: Some("dark".to_string()),
            snapshots: Some(vec![
                SnapshotEntry {
                    id: "snap-1".to_string(),
                    created_at: "2024-01-01T00:00:00Z".to_string(),
                    note: Some("Initial version".to_string()),
                    content: "graph TD\nA-->B".to_string(),
                },
            ]),
        };
        
        assert_eq!(file.snapshots.as_ref().unwrap().len(), 1);
        assert_eq!(file.snapshots.unwrap()[0].note, Some("Initial version".to_string()));
    }

    #[test]
    fn test_foldernode_serialization() {
        let folder = FolderNode {
            id: "folder-1".to_string(),
            name: "My Folder".to_string(),
            files: vec![
                FileNode {
                    id: "file-1".to_string(),
                    name: "diagram.mmd".to_string(),
                    content: "graph TD".to_string(),
                    preview_background: None,
                    snapshots: None,
                },
            ],
        };
        
        let json = serde_json::to_string(&folder).unwrap();
        let deserialized: FolderNode = serde_json::from_str(&json).unwrap();
        
        assert_eq!(deserialized.name, "My Folder");
        assert_eq!(deserialized.files.len(), 1);
        assert_eq!(deserialized.files[0].name, "diagram.mmd");
    }

    // LayoutState tests
    #[test]
    fn test_layout_state_serialization() {
        let layout = LayoutState {
            sidebar_width: Some(250.0),
            editor_width: Some(400.0),
        };
        
        let json = serde_json::to_string(&layout).unwrap();
        assert!(json.contains("250"));
        assert!(json.contains("400"));
        
        let deserialized: LayoutState = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.sidebar_width, Some(250.0));
        assert_eq!(deserialized.editor_width, Some(400.0));
    }

    // Snapshot entry tests
    #[test]
    fn test_snapshot_entry_without_note() {
        let snapshot = SnapshotEntry {
            id: "snap-1".to_string(),
            created_at: "2024-01-01T00:00:00Z".to_string(),
            note: None,
            content: "graph TD".to_string(),
        };
        
        assert!(snapshot.note.is_none());
        let json = serde_json::to_string(&snapshot).unwrap();
        assert!(json.contains("snap-1"));
    }

    // Edge cases for parse_chat
    #[test]
    fn test_parse_chat_with_special_characters() {
        let content = r#"<!-- message: {"id":"msg-1","role":"user","timestamp":"2024-01-01"} -->
Line with special chars: <>&""#;
        
        let messages = parse_chat(content);
        assert_eq!(messages.len(), 1);
        assert!(messages[0].content.contains("<>&\""));
    }

    #[test]
    fn test_parse_chat_with_empty_lines_between() {
        let content = r#"<!-- message: {"id":"msg-1","role":"user","timestamp":"2024-01-01"} -->
First line


Last line

<!-- message: {"id":"msg-2","role":"assistant","timestamp":"2024-01-01"} -->
Response"#;
        
        let messages = parse_chat(content);
        assert_eq!(messages.len(), 2);
        assert!(messages[0].content.contains("\n\n"));
    }

    // Chat message format tests
    #[test]
    fn test_format_message_escaping() {
        let message = ChatMessage {
            id: "msg-1".to_string(),
            role: "user".to_string(),
            content: "Content with \"quotes\" and \\ backslash".to_string(),
            timestamp: "2024-01-01T00:00:00Z".to_string(),
            attachments: None,
            applied_mermaid: None,
        };
        
        let formatted = format_message(&message).unwrap();
        let parsed_back: Vec<ChatMessage> = parse_chat(&formatted);
        
        assert_eq!(parsed_back.len(), 1);
        assert_eq!(parsed_back[0].content, message.content);
    }

    // File content roundtrip test
    #[test]
    fn test_chat_file_roundtrip() {
        let temp_dir = TempDir::new().unwrap();
        let chat_file = temp_dir.path().join("chat.md");
        
        let messages = vec![
            ChatMessage {
                id: "1".to_string(),
                role: "user".to_string(),
                content: "Hello".to_string(),
                timestamp: "2024-01-01T00:00:00Z".to_string(),
                attachments: None,
                applied_mermaid: None,
            },
            ChatMessage {
                id: "2".to_string(),
                role: "assistant".to_string(),
                content: "Hi there".to_string(),
                timestamp: "2024-01-01T00:00:01Z".to_string(),
                attachments: None,
                applied_mermaid: None,
            },
        ];
        
        // Write messages to file
        let mut file_content = String::new();
        for msg in &messages {
            file_content.push_str(&format_message(msg).unwrap());
        }
        fs::write(&chat_file, file_content).unwrap();
        
        // Read back and parse
        let read_content = fs::read_to_string(&chat_file).unwrap();
        let parsed = parse_chat(&read_content);
        
        assert_eq!(parsed.len(), 2);
        assert_eq!(parsed[0].content, "Hello");
        assert_eq!(parsed[1].content, "Hi there");
    }

    // Attachment metadata tests
    #[test]
    fn test_attachment_meta_various_sizes() {
        let small = AttachmentMeta {
            id: "small.txt".to_string(),
            name: "small.txt".to_string(),
            filename: "small.txt".to_string(),
            size: 100,
        };
        
        let large = AttachmentMeta {
            id: "large.bin".to_string(),
            name: "large.bin".to_string(),
            filename: "large.bin".to_string(),
            size: 5 * 1024 * 1024, // 5MB
        };
        
        assert_eq!(small.size, 100);
        assert_eq!(large.size, 5 * 1024 * 1024);
    }

    // AppState with layout serialization
    #[test]
    fn test_app_state_with_layout_roundtrip() {
        let mut state = AppState::default();
        state.layout = Some(LayoutState {
            sidebar_width: Some(300.0),
            editor_width: Some(500.0),
        });
        
        let json = serde_json::to_string(&state).unwrap();
        let deserialized: AppState = serde_json::from_str(&json).unwrap();
        
        assert!(deserialized.layout.is_some());
        let layout = deserialized.layout.unwrap();
        assert_eq!(layout.sidebar_width, Some(300.0));
        assert_eq!(layout.editor_width, Some(500.0));
    }

    // OAuth credentials tests
    #[test]
    fn test_oauth_credentials_serialization() {
        let oauth = oauth::OAuthCredentials {
            access_token: "token123".to_string(),
            refresh_token: "refresh456".to_string(),
            expires_at: 1234567890123,
            project_id: "my-project".to_string(),
            email: Some("user@example.com".to_string()),
        };
        
        let json = serde_json::to_string(&oauth).unwrap();
        assert!(json.contains("token123"));
        assert!(json.contains("my-project"));
        assert!(json.contains("user@example.com"));
        
        let deserialized: oauth::OAuthCredentials = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.access_token, "token123");
        assert_eq!(deserialized.expires_at, 1234567890123);
    }
}
