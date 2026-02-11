import { useRef, useEffect } from "react";
import { type AgentActivity as AgentActivityType } from "../api/client";

interface Props {
  activities: AgentActivityType[];
}

export function AgentActivityPanel({ activities }: Props) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [activities]);

  if (activities.length === 0) {
    return null;
  }

  return (
    <div className="agent-activity-panel">
      <h4>Agent Activity</h4>
      <div className="activity-list" ref={listRef}>
        {activities.map((activity) => (
          <div
            key={activity.id}
            className={`activity-item ${activity.status}`}
          >
            <span className="agent-icon">{activity.icon}</span>
            <div className="activity-content">
              <div className="activity-header">
                <span className="agent-name">{activity.agent_name}</span>
                <span className={`status-badge ${activity.status}`}>
                  {activity.status === "thinking" && "..."}
                  {activity.status === "completed" && "Done"}
                  {activity.status === "delegating" && "->"}
                  {activity.status === "started" && "Start"}
                </span>
              </div>
              <p className="activity-message">{activity.message}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
