import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "../../../components/common/Icon";
import HoverTooltip from "../../../components/common/HoverTooltip";
import GlassSurface from "../../../components/common/GlassSurface";
import { projectService } from "../../../services/projectService";
import "./CrewHierarchy.css";

const OrgNode = ({
  node,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onAddNode,
  onEditNode,
}) => {
  const handleDragStart = (e) => {
    e.stopPropagation();
    onDragStart(e, node.id);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onDragOver(e, node.id);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onDragLeave(e, node.id);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onDrop(e, node.id);
  };

  return (
    <li>
      <div
        className="org-node-card"
        data-node-id={node.id}
        draggable={true}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={(e) => {
          e.stopPropagation();
          if (onEditNode) onEditNode(node.id, node, e);
        }}
        style={{ cursor: "pointer" }}
      >
        {node.department && (
          <div className="org-node-title">
            {node.department}
            <HoverTooltip text="Add Child Node">
              <button
                className="add-node-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddNode(node.id, e);
                }}
              >
                +
              </button>
            </HoverTooltip>
          </div>
        )}
        <div className="org-node-members">
          {node.members.map((member, idx) => (
            <div key={idx} className="org-node-member">
              <div className="org-avatar">
                {member.name ? member.name.charAt(0).toUpperCase() : "?"}
              </div>
              <div className="org-member-info">
                <span className="org-member-name">{member.name}</span>
                <span className="org-member-role">{member.role}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      {node.children && node.children.length > 0 && (
        <ul>
          {node.children.map((child) => (
            <OrgNode
              key={child.id}
              node={child}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onAddNode={onAddNode}
              onEditNode={onEditNode}
            />
          ))}
        </ul>
      )}
    </li>
  );
};

const generateId = () => Math.random().toString(36).substring(2, 9);

const assignIds = (node) => ({
  ...node,
  id: generateId(),
  children: node.children ? node.children.map(assignIds) : [],
});

const CrewHierarchy = ({ project, onUpdateHierarchy, onSaveStatusChange }) => {
  const containerRef = useRef(null);
  const treeRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [isAutoFit, setIsAutoFit] = useState(true);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });
  const [draggedNodeId, setDraggedNodeId] = useState(null);

  // Mini Modal State
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addNodeParentId, setAddNodeParentId] = useState(null);
  const [newNodeData, setNewNodeData] = useState({
    department: "",
    members: [{ role: "", name: "" }],
  });
  const [modalPosition, setModalPosition] = useState({
    top: 0,
    left: 0,
    bottom: "auto",
  });
  const [modalMode, setModalMode] = useState("add"); // 'add' or 'edit'
  const [editNodeId, setEditNodeId] = useState(null);

  const crewList = project?.crew_usernames
    ? project.crew_usernames.split(",").map((n) => n.trim())
    : [];

  const getCrewOrPlaceholder = (index, fallbackName) => {
    return crewList[index] || fallbackName;
  };

  const initialData = {
    department: "Executive",
    members: [
      { name: getCrewOrPlaceholder(0, "Director Name"), role: "Director" },
    ],
    children: [
      {
        department: "Production",
        members: [
          { name: getCrewOrPlaceholder(1, "Producer Name"), role: "Producer" },
        ],
        children: [
          {
            department: "Camera",
            members: [
              {
                name: getCrewOrPlaceholder(2, "DOP Name"),
                role: "Director of Photography",
              },
              {
                name: getCrewOrPlaceholder(3, "Cam Op"),
                role: "Camera Operator",
              },
            ],
          },
          {
            department: "Sound",
            members: [
              {
                name: getCrewOrPlaceholder(4, "Sound Mixer"),
                role: "Sound Mixer",
              },
            ],
          },
          {
            department: "Art",
            members: [
              {
                name: getCrewOrPlaceholder(5, "Art Director"),
                role: "Art Director",
              },
              {
                name: getCrewOrPlaceholder(6, "Prop Master"),
                role: "Prop Master",
              },
            ],
          },
        ],
      },
    ],
  };

  const [treeData, setTreeData] = useState(() => {
    if (project?.crew_hierarchy_data) {
      try {
        const parsed =
          typeof project.crew_hierarchy_data === "string"
            ? JSON.parse(project.crew_hierarchy_data)
            : project.crew_hierarchy_data;
        return parsed;
      } catch (e) {
        console.error("Failed to parse crew_hierarchy_data", e);
      }
    }
    return assignIds(initialData);
  });

  const initialMount = useRef(true);
  const latestTreeData = useRef(treeData);

  // Update ref whenever treeData changes so unmount can access the latest state
  useEffect(() => {
    latestTreeData.current = treeData;
  }, [treeData]);

  // Auto-save debounce effect
  useEffect(() => {
    if (initialMount.current) {
      initialMount.current = false;
      return;
    }

    if (!project?.id) return;

    const timer = setTimeout(async () => {
      if (onSaveStatusChange) onSaveStatusChange("saving");
      try {
        await projectService.updateCrewHierarchy(project.id, treeData);
        if (project) {
          project.crew_hierarchy_data = JSON.stringify(treeData);
        }
        if (onSaveStatusChange) {
          onSaveStatusChange("saved");
          setTimeout(() => {
            onSaveStatusChange((prev) => (prev === "saved" ? "hiding" : prev));
            setTimeout(() => {
              onSaveStatusChange((prev) => (prev === "hiding" ? "" : prev));
            }, 450); // wait for CSS animation to finish
          }, 2500); // 2.5 seconds showing 'Saved'
        }
      } catch (err) {
        console.error("Failed to save hierarchy:", err);
        if (onSaveStatusChange) onSaveStatusChange("");
      }
    }, 1500);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treeData, project?.id, onSaveStatusChange]);

  // Save immediately on unmount if there are unsaved changes
  useEffect(() => {
    return () => {
      if (project?.id && latestTreeData.current) {
        // Fire and forget save when closing the modal
        projectService
          .updateCrewHierarchy(project.id, latestTreeData.current)
          .then(() => {
            if (project)
              project.crew_hierarchy_data = JSON.stringify(
                latestTreeData.current,
              );
          })
          .catch((err) => {
            console.error("Failed to save hierarchy on unmount:", err);
          });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  // Helper to deep clone and modify tree
  const reparentNode = (tree, draggedId, targetId) => {
    if (draggedId === targetId) return tree;

    let draggedNode = null;
    let isTargetDescendant = false;

    // 0. Find the dragged node and check for circular dependency
    const findNodeAndCheckDescendant = (node) => {
      if (node.id === draggedId) {
        draggedNode = node;
        // Check if target is inside this node
        const checkDescendant = (desc) => {
          if (desc.id === targetId) isTargetDescendant = true;
          if (desc.children) desc.children.forEach(checkDescendant);
        };
        checkDescendant(node);
      }
      if (node.children) node.children.forEach(findNodeAndCheckDescendant);
    };

    findNodeAndCheckDescendant(tree);

    if (!draggedNode || isTargetDescendant) {
      return tree; // Abort if node not found or trying to drag into own descendant
    }

    // 1. Find and remove the dragged node from its current parent
    const removeNode = (node) => {
      if (!node.children) return node;
      const filteredChildren = node.children.filter(
        (child) => child.id !== draggedId,
      );
      return {
        ...node,
        children: filteredChildren.map(removeNode),
      };
    };

    let newTree = removeNode(tree);

    // 2. Add the dragged node to the target parent
    const addNode = (node) => {
      if (node.id === targetId) {
        return {
          ...node,
          children: [...(node.children || []), draggedNode],
        };
      }
      if (!node.children) return node;
      return {
        ...node,
        children: node.children.map(addNode),
      };
    };

    return addNode(newTree);
  };

  const onDragStart = (e, id) => {
    setDraggedNodeId(id);
    e.dataTransfer.effectAllowed = "move";
    e.target.style.opacity = "0.5";
  };

  const onDragOver = (e, id) => {
    e.dataTransfer.dropEffect = "move";
    e.currentTarget.classList.add("drag-over");
  };

  const onDragLeave = (e, id) => {
    e.currentTarget.classList.remove("drag-over");
  };

  const onDrop = (e, id) => {
    e.currentTarget.classList.remove("drag-over");
    if (draggedNodeId && draggedNodeId !== id) {
      setTreeData((prevTree) => reparentNode(prevTree, draggedNodeId, id));
      if (onUpdateHierarchy) onUpdateHierarchy();
    }
    setDraggedNodeId(null);
    // Reset opacity of all nodes (cheap way to clean up drag styles)
    document
      .querySelectorAll(".org-node-card")
      .forEach((el) => (el.style.opacity = "1"));
  };

  const calculateModalPosition = (
    targetRect,
    containerRect,
    mode,
    currentScale,
  ) => {
    let left = targetRect.right + 15;
    let top = mode === "edit" ? targetRect.top : targetRect.top - 20;
    let bottom = "auto";
    let transformOrigin = "top left";

    if (left + 180 * currentScale > containerRect.right) {
      left = targetRect.left - 190 * currentScale;
      transformOrigin = "top right";
    }
    if (top + 240 * currentScale > containerRect.bottom) {
      top = "auto";
      bottom = window.innerHeight - targetRect.bottom;
      transformOrigin = transformOrigin.replace("top", "bottom");
    }

    return { top, left, bottom, transformOrigin };
  };

  const onAddNode = (parentId, e) => {
    if (e) {
      const buttonRect = e.currentTarget.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();

      setModalPosition(
        calculateModalPosition(buttonRect, containerRect, "add", scale),
      );
    }

    setModalMode("add");
    setAddNodeParentId(parentId);
    setNewNodeData({ department: "", members: [{ role: "", name: "" }] });
    setAddModalVisible(true);
  };

  const onEditNode = (nodeId, node, e) => {
    if (e && containerRef.current) {
      const cardRect = e.currentTarget.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();

      setModalPosition(
        calculateModalPosition(cardRect, containerRect, "edit", scale),
      );
    }

    setModalMode("edit");
    setEditNodeId(nodeId);
    setNewNodeData({
      department: node.department || "",
      members:
        node.members && node.members.length > 0
          ? node.members.map((m) => ({
              role: m.role || "",
              name: m.name || "",
            }))
          : [{ role: "", name: "" }],
    });
    setAddModalVisible(true);
  };

  const handleDeleteNode = () => {
    const deleteNode = (node) => {
      if (!node.children) return node;
      // Filter out the child that matches editNodeId
      const filteredChildren = node.children.filter(
        (child) => child.id !== editNodeId,
      );
      return {
        ...node,
        children: filteredChildren.map(deleteNode),
      };
    };

    // Prevent deleting the root node if it matches (optional but good practice)
    if (treeData.id === editNodeId) {
      alert("Cannot delete the root node.");
      return;
    }

    setTreeData((prevTree) => deleteNode(prevTree));
    if (onUpdateHierarchy) onUpdateHierarchy();
    setAddModalVisible(false);
  };

  const handleSaveNode = () => {
    if (!newNodeData.department.trim()) return;

    // Ensure we don't save empty members
    const cleanMembers = newNodeData.members
      .filter((m) => m.name.trim() || m.role.trim())
      .map((m) => ({
        name: m.name.trim() || "New Member",
        role: m.role.trim() || "Member",
      }));

    // If all were empty, provide a default
    if (cleanMembers.length === 0) {
      cleanMembers.push({ name: "New Member", role: "Member" });
    }

    if (modalMode === "add") {
      const newNode = {
        id: generateId(),
        department: newNodeData.department,
        members: cleanMembers,
        children: [],
      };

      const addChild = (node) => {
        if (node.id === addNodeParentId) {
          return {
            ...node,
            children: [...(node.children || []), newNode],
          };
        }
        if (!node.children) return node;
        return {
          ...node,
          children: node.children.map(addChild),
        };
      };

      setTreeData((prevTree) => addChild(prevTree));
    } else if (modalMode === "edit") {
      const editNode = (node) => {
        if (node.id === editNodeId) {
          return {
            ...node,
            department: newNodeData.department,
            members: cleanMembers,
          };
        }
        if (!node.children) return node;
        return {
          ...node,
          children: node.children.map(editNode),
        };
      };

      setTreeData((prevTree) => editNode(prevTree));
    }

    if (onUpdateHierarchy) onUpdateHierarchy();
    setAddModalVisible(false);
  };

  const handleCanvasMouseDown = (e) => {
    if (
      e.target.closest(".org-node-card") ||
      e.target.closest(".add-node-btn") ||
      e.target.closest(".org-zoom-controls")
    )
      return;
    setIsDraggingCanvas(true);
    setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleCanvasMouseMove = (e) => {
    if (!isDraggingCanvas) return;
    setPan({ x: e.clientX - startPan.x, y: e.clientY - startPan.y });
  };

  const handleCanvasMouseUp = () => {
    setIsDraggingCanvas(false);
  };

  const handleZoomIn = () => {
    setIsAutoFit(false);
    setScale((s) => Math.min(s + 0.1, 2));
  };

  const handleZoomOut = () => {
    setIsAutoFit(false);
    setScale((s) => Math.max(s - 0.1, 0.1));
  };

  const handleZoomFit = () => {
    setIsAutoFit(true);
    setPan({ x: 0, y: 0 });
    // Trigger immediate resize recalculation
    if (containerRef.current && treeRef.current) {
      const containerWidth = containerRef.current.clientWidth;
      const containerHeight = containerRef.current.clientHeight;
      const treeWidth = treeRef.current.scrollWidth;
      const treeHeight = treeRef.current.scrollHeight;
      const scaleX = Math.max(containerWidth - 80, 10) / treeWidth;
      const scaleY = Math.max(containerHeight - 80, 10) / treeHeight;
      setScale(Math.max(Math.min(scaleX, scaleY, 1), 0.1));
    }
  };

  useEffect(() => {
    const handleResize = () => {
      if (!isAutoFit || !containerRef.current || !treeRef.current) return;

      const containerWidth = containerRef.current.clientWidth;
      const containerHeight = containerRef.current.clientHeight;

      const treeWidth = treeRef.current.scrollWidth;
      const treeHeight = treeRef.current.scrollHeight;

      // Calculate scaling factor to fit width and height, capped at 1 (no upscaling)
      const scaleX = Math.max(containerWidth - 80, 10) / treeWidth;
      const scaleY = Math.max(containerHeight - 80, 10) / treeHeight;
      const newScale = Math.max(Math.min(scaleX, scaleY, 1), 0.1);

      setScale(newScale);
    };

    const observer = new ResizeObserver(handleResize);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    // Initial calculation
    handleResize();

    return () => observer.disconnect();
  }, [treeData, isAutoFit]);

  useEffect(() => {
    if (addModalVisible && (editNodeId || addNodeParentId)) {
      const targetId = modalMode === "edit" ? editNodeId : addNodeParentId;
      const selector =
        modalMode === "edit"
          ? `[data-node-id="${targetId}"]`
          : `[data-node-id="${targetId}"] .add-node-btn`;

      const nodeEl = document.querySelector(selector);
      if (nodeEl && containerRef.current) {
        const rect = nodeEl.getBoundingClientRect();
        const containerRect = containerRef.current.getBoundingClientRect();

        setModalPosition((prev) => {
          const next = calculateModalPosition(
            rect,
            containerRect,
            modalMode,
            scale,
          );
          if (
            prev.top === next.top &&
            prev.left === next.left &&
            prev.bottom === next.bottom &&
            prev.transformOrigin === next.transformOrigin
          ) {
            return prev;
          }
          return next;
        });
      }
    }
  }, [scale, pan, addModalVisible, editNodeId, addNodeParentId, modalMode]);

  return (
    <div
      className="org-tree-wrapper"
      ref={containerRef}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleCanvasMouseMove}
      onMouseUp={handleCanvasMouseUp}
      onMouseLeave={handleCanvasMouseUp}
      style={{ cursor: isDraggingCanvas ? "grabbing" : "grab" }}
    >
      <div
        className="org-tree org-tree-scaled"
        ref={treeRef}
        style={{
          transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${scale})`,
        }}
      >
        <ul>
          <OrgNode
            node={treeData}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onAddNode={(parentId, e) => onAddNode(parentId, e)}
            onEditNode={onEditNode}
          />
        </ul>
      </div>

      <GlassSurface
        className="org-zoom-controls"
        width="max-content"
        height="max-content"
        borderRadius={12}
        blur={8}
        opacity={0.5}
        backgroundOpacity={0.2}
        distortionScale={80}
        displace={1.9}
      >
        <HoverTooltip text="Zoom Out">
          <button onClick={handleZoomOut}>
            <Icon name="remove" modifiers="sm" />
          </button>
        </HoverTooltip>
        <HoverTooltip text="Fit to Screen">
          <button onClick={handleZoomFit}>
            <Icon name="fit_screen" modifiers="sm" />
          </button>
        </HoverTooltip>
        <HoverTooltip text="Zoom In">
          <button onClick={handleZoomIn}>
            <Icon name="add" modifiers="sm" />
          </button>
        </HoverTooltip>
      </GlassSurface>

      {addModalVisible &&
        createPortal(
          <div className="mm-overlay" onClick={() => setAddModalVisible(false)}>
            <div
              className="mm-card"
              onClick={(e) => e.stopPropagation()}
              style={{
                top:
                  modalPosition.top !== "auto"
                    ? `${modalPosition.top}px`
                    : "auto",
                left: `${modalPosition.left}px`,
                bottom:
                  modalPosition.bottom !== "auto"
                    ? `${modalPosition.bottom}px`
                    : "auto",
                transform: `scale(${scale})`,
                transformOrigin: modalPosition.transformOrigin || "top left",
              }}
            >
              <div className="mm-header" style={{ position: "relative" }}>
                <h2>{modalMode === "add" ? "Add Node" : "Edit Node"}</h2>
                <p>
                  {modalMode === "add"
                    ? "Create new department"
                    : "Update department details"}
                </p>
                {modalMode === "edit" && treeData.id !== editNodeId && (
                  <HoverTooltip
                    text="Delete Node"
                    style={{ position: "absolute", top: "-2px", right: "-2px" }}
                  >
                    <button
                      className="mm-delete-btn"
                      onClick={handleDeleteNode}
                    >
                      <Icon name="delete" modifiers="sm" />
                    </button>
                  </HoverTooltip>
                )}
              </div>
              <input
                type="text"
                className="mm-input"
                placeholder="Department Name (e.g. Electrical)"
                value={newNodeData.department}
                onChange={(e) =>
                  setNewNodeData({ ...newNodeData, department: e.target.value })
                }
                autoFocus
              />

              <div className="mm-members-list">
                {newNodeData.members.map((member, index) => (
                  <div key={index} className="mm-member-group">
                    <div className="mm-member-header">
                      <span className="mm-member-label">
                        Member {index + 1}
                      </span>
                      {newNodeData.members.length > 1 && (
                        <HoverTooltip text="Remove Member">
                          <button
                            className="mm-remove-member-btn"
                            onClick={() => {
                              const newMembers = [...newNodeData.members];
                              newMembers.splice(index, 1);
                              setNewNodeData({
                                ...newNodeData,
                                members: newMembers,
                              });
                            }}
                          >
                            <Icon name="close" modifiers="sm" />
                          </button>
                        </HoverTooltip>
                      )}
                    </div>
                    <input
                      type="text"
                      className="mm-input mm-input-sm"
                      placeholder="Role (e.g. Gaffer)"
                      value={member.role}
                      onChange={(e) => {
                        const newMembers = [...newNodeData.members];
                        newMembers[index].role = e.target.value;
                        setNewNodeData({ ...newNodeData, members: newMembers });
                      }}
                    />
                    <input
                      type="text"
                      className="mm-input mm-input-sm"
                      placeholder="Name (optional)"
                      value={member.name}
                      onChange={(e) => {
                        const newMembers = [...newNodeData.members];
                        newMembers[index].name = e.target.value;
                        setNewNodeData({ ...newNodeData, members: newMembers });
                      }}
                    />
                  </div>
                ))}
              </div>

              <button
                className="mm-add-member-btn"
                onClick={() =>
                  setNewNodeData({
                    ...newNodeData,
                    members: [...newNodeData.members, { role: "", name: "" }],
                  })
                }
              >
                <Icon name="add" modifiers="sm" /> Add another member
              </button>
              <div className="mm-actions">
                <button
                  className="btn-neo-cancel"
                  onClick={() => setAddModalVisible(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn-neo btn-neo-solid"
                  onClick={handleSaveNode}
                  disabled={!newNodeData.department.trim()}
                >
                  {modalMode === "add" ? "Add" : "Save"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};

export default CrewHierarchy;
