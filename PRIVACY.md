# Privacy Policy for Markdown Auto Sync

**Effective Date**: October 4, 2026  
**Last Updated**: October 4, 2026

This Privacy Policy explains how **Markdown Auto Sync** ("the Application", "we", "us", or "our"), a Google Workspace Add-on, accesses, processes, and protects your information when you use our software.

We are committed to respecting your privacy. The Application is designed to operate completely within your personal Google account environment without sending any of your documents or personal data to external servers.

---

## 1. Information We Access and Process

Markdown Auto Sync processes only the minimum data necessary to convert your Google Docs into Markdown (`.md`) format:

- **Active Document Content**: The text, headings, inline styling (bold, italic, strikethrough, monospace/code, hyperlinks), lists, and tables of the currently active Google Doc that you choose to sync.
- **Drive Metadata**: The document's title and its parent folder ID, used solely to create or update the corresponding `[Document Title].md` file in the exact same Google Drive location.
- **User Interface Preferences**: Language preference (Korean or English) and the timestamp of the most recent sync, saved securely within your Google account's `UserProperties` and `DocumentProperties`.

> **Note**: All conversion operations occur entirely in-memory and in real time during the execution of the script.

---

## 2. Data Storage, Transmission, and Security

- **No External Servers**: Markdown Auto Sync does **not** operate any external backend servers, analytics services, or third-party databases. None of your document contents, file names, or personal data are ever transmitted outside of Google's infrastructure.
- **Client-Side / In-Account Execution**: All processing is performed strictly within your Google Workspace environment via Google Apps Script and official Google Drive/Docs APIs.
- **No Permanent Retention**: We do not store or retain your document contents. Once the Markdown file is created or updated in your Google Drive, the in-memory data is immediately discarded.

---

## 3. Third-Party Sharing and Advertising

- **Zero Third-Party Sharing**: We do not sell, rent, trade, or transfer your documents, metadata, or personal information to any third parties.
- **No Advertising or Profiling**: Your data is never used for personalized advertising, behavioral tracking, user profiling, or training artificial intelligence / machine learning models.

---

## 4. Google API Services User Data Policy Compliance

Markdown Auto Sync's use and transfer to any other app of information received from Google APIs adheres to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the **Limited Use** requirements.

Specifically:
- We access Google user data only to provide and improve user-facing features (converting documents to Markdown files in the same folder).
- We never transfer user data to third parties, except as necessary to provide the service directly within Google's own ecosystem.
- We never use or transfer human-readable user data for serving advertisements.
- We do not allow humans to read user data unless required by applicable law or with your explicit permission for troubleshooting purposes.

---

## 5. Disclosure of Requested OAuth Scopes

Markdown Auto Sync requests the following permissions strictly to provide its core functionality:

| OAuth Scope | Purpose of Use |
| :--- | :--- |
| `https://www.googleapis.com/auth/documents.currentonly` | Read the text and formatting of the currently active Google Doc to convert it into Markdown format. |
| `https://www.googleapis.com/auth/drive` | Locate the document's parent folder and create or update the `.md` file in the same directory. |
| `https://www.googleapis.com/auth/script.scriptapp` | Schedule and manage the 1-hour background automatic synchronization trigger requested by the user. |
| `https://www.googleapis.com/auth/script.container.ui` | Render the sidebar user interface (CardService) and display interactive action responses and notifications. |

---

## 6. Children's Privacy

Our Application does not address anyone under the age of 13. We do not knowingly collect personally identifiable information from children.

---

## 7. Changes to This Privacy Policy

We may update our Privacy Policy from time to time to reflect changes in legal requirements or platform functionality. Any updates will be posted on this page with an updated "Last Updated" date.

---

## 8. Contact Information

If you have any questions, concerns, or requests regarding this Privacy Policy or the security of the Application, please contact:

- **Application Name**: Markdown Auto Sync
- **Developer / Maintainer**: [Your Name or Nickname]
- **Email**: [Your Contact Email]
- **Source Code Repository**: [https://github.com/parabo/docs-markdown-sync](https://github.com/parabo/docs-markdown-sync)
