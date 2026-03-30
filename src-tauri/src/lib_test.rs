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
}
