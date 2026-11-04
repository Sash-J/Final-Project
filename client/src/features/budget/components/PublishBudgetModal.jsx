import React, { useState, useEffect, useCallback, useMemo } from "react";
import PropTypes from "prop-types";
import PublishModal from "../../../components/common/PublishModal";
import { budgetService } from "../../../services/budgetService";

/**
 * PublishBudgetModal - Budget Revision publishing adapter for PublishModal.
 * Cleanly separates concerns, removes legacy browser alerts, and handles version switching.
 */
const PublishBudgetModal = ({
  isOpen,
  onClose,
  projectId,
  versionsCache = {},
  initialVersionId,
  onSuccess,
}) => {
  const [selectedPublishVersionId, setSelectedPublishVersionId] = useState("");
  const [publishToCrew, setPublishToCrew] = useState(false);
  const [publishToClient, setPublishToClient] = useState(false);
  const [transmittalNote, setTransmittalNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const versionList = useMemo(
    () => (projectId ? versionsCache[projectId] || [] : []),
    [projectId, versionsCache]
  );

  // Sync state whenever modal opens or target version changes
  useEffect(() => {
    if (isOpen && initialVersionId) {
      setSelectedPublishVersionId(initialVersionId);
      const currentVersion = versionList.find(
        (v) => String(v.id) === String(initialVersionId)
      );
      if (currentVersion) {
        setPublishToCrew(Boolean(currentVersion.published_to_crew));
        setPublishToClient(Boolean(currentVersion.published_to_client));
      } else {
        setPublishToCrew(false);
        setPublishToClient(false);
      }
      setTransmittalNote("");
    }
  }, [isOpen, initialVersionId, versionList]);

  const handlePublishVersionChange = useCallback(
    (targetVersionId) => {
      setSelectedPublishVersionId(targetVersionId);
      const targetVersion = versionList.find(
        (v) => String(v.id) === String(targetVersionId)
      );
      if (targetVersion) {
        setPublishToCrew(Boolean(targetVersion.published_to_crew));
        setPublishToClient(Boolean(targetVersion.published_to_client));
      } else {
        setPublishToCrew(false);
        setPublishToClient(false);
      }
    },
    [versionList]
  );

  const currentSelectedVersion = useMemo(
    () =>
      versionList.find(
        (v) => String(v.id) === String(selectedPublishVersionId)
      ) || null,
    [versionList, selectedPublishVersionId]
  );

  const activeEditorVersion = useMemo(
    () =>
      versionList.find((v) => String(v.id) === String(initialVersionId)) ||
      null,
    [versionList, initialVersionId]
  );

  const versionOptions = useMemo(
    () =>
      versionList.map((v) => {
        const tags = [];
        if (v.published_to_crew) tags.push("Crew");
        if (v.published_to_client) tags.push("Client");
        const tagStr = tags.length > 0 ? ` [Published: ${tags.join(" & ")}]` : "";
        return {
          id: v.id,
          label: `Version ${v.version_number}${tagStr}`,
        };
      }),
    [versionList]
  );

  const documentData = useMemo(() => {
    if (!currentSelectedVersion) return {};
    const isPub = Boolean(
      currentSelectedVersion.published_to_crew ||
        currentSelectedVersion.published_to_client
    );
    return {
      id: currentSelectedVersion.id,
      code: `VER-${String(currentSelectedVersion.version_number).padStart(2, "0")}`,
      title: `Budget Revision v${currentSelectedVersion.version_number}`,
      subtitle: activeEditorVersion
        ? `Editor Active: Version ${activeEditorVersion.version_number}`
        : "Budget Statement",
      isPublished: isPub,
      publishedAt: currentSelectedVersion.published_at,
    };
  }, [currentSelectedVersion, activeEditorVersion]);

  const audiences = useMemo(
    () => [
      {
        id: "client",
        title: "Client Portal & Organization",
        description:
          "Release approved budget statement into the client's financial vault and dashboard.",
        icon: "apartment",
        badge: "External Client",
        checked: publishToClient,
        onChange: setPublishToClient,
      },
      {
        id: "crew",
        title: "Production Crew & Department Heads",
        description:
          "Grant assigned crew visibility into shooting budget phases and department allocations.",
        icon: "groups",
        badge: "Internal Crew",
        checked: publishToCrew,
        onChange: setPublishToCrew,
      },
    ],
    [publishToClient, publishToCrew]
  );

  const handleSavePublishSettings = useCallback(async () => {
    if (!selectedPublishVersionId) return;
    setIsSubmitting(true);
    try {
      const data = await budgetService.publishBudgetVersion(
        selectedPublishVersionId,
        {
          published_to_crew: publishToCrew,
          published_to_client: publishToClient,
          transmittal_note: transmittalNote.trim() || undefined,
        }
      );

      if (data && !data.error) {
        if (onSuccess) {
          await onSuccess();
        }
        onClose();
      } else {
        console.error("Failed to update budget publish settings:", data?.error);
      }
    } catch (err) {
      console.error("Error saving publish settings:", err);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    selectedPublishVersionId,
    publishToCrew,
    publishToClient,
    transmittalNote,
    onSuccess,
    onClose,
  ]);

  const handleRevokePublication = useCallback(async () => {
    if (!selectedPublishVersionId) return;
    setIsSubmitting(true);
    try {
      const data = await budgetService.publishBudgetVersion(
        selectedPublishVersionId,
        {
          published_to_crew: false,
          published_to_client: false,
        }
      );

      if (data && !data.error) {
        setPublishToCrew(false);
        setPublishToClient(false);
        if (onSuccess) {
          await onSuccess();
        }
        onClose();
      }
    } catch (err) {
      console.error("Error revoking publish settings:", err);
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedPublishVersionId, onSuccess, onClose]);

  if (!isOpen) return null;

  return (
    <PublishModal
      isOpen={isOpen}
      onClose={onClose}
      entityType="budget"
      documentData={documentData}
      versionOptions={versionOptions}
      selectedVersionId={selectedPublishVersionId}
      onVersionChange={handlePublishVersionChange}
      audiences={audiences}
      transmittalNote={transmittalNote}
      onTransmittalNoteChange={setTransmittalNote}
      onPublish={handleSavePublishSettings}
      onUnpublish={
        documentData.isPublished ? handleRevokePublication : undefined
      }
      isSubmitting={isSubmitting}
    />
  );
};

PublishBudgetModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  versionsCache: PropTypes.object,
  initialVersionId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onSuccess: PropTypes.func,
};

export default PublishBudgetModal;
