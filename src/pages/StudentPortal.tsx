import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import StudentSidebar from "@/components/student/StudentSidebar";
import StudentDashboardView from "@/components/student/StudentDashboardView";
import StudentDietView from "@/components/student/StudentDietView";
import StudentWorkoutsView from "@/components/student/StudentWorkoutsView";
import StudentVideosView from "@/components/student/StudentVideosView";
import StudentChatView from "@/components/student/StudentChatView";
import StudentProgressView from "@/components/student/StudentProgressView";
import StudentFinancialView from "@/components/student/StudentFinancialView";
import StudentProfileView from "@/components/student/StudentProfileView";
import StudentReportsView from "@/components/student/StudentReportsView";
import StudentMessagesView from "@/components/student/StudentMessagesView";
import StudentWeeklyCheckin from "@/components/student/StudentWeeklyCheckin";
import StudentProgressDashboard from "@/components/student/StudentProgressDashboard";
import NotificationsPopover from "@/components/NotificationsPopover";

const StudentPortal = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "dashboard");

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <StudentDashboardView />;
      case "diet":
        return <StudentDietView />;
      case "workouts":
        return <StudentWorkoutsView />;
      case "videos":
        return <StudentVideosView />;
      case "chat":
        return <StudentChatView />;
      case "messages":
        return <StudentMessagesView />;
      case "reports":
        return <StudentReportsView />;
      case "progress":
        return <StudentProgressView />;
      case "financial":
        return <StudentFinancialView />;
      case "profile":
        return <StudentProfileView />;
      case "checkin":
        return <StudentWeeklyCheckin />;
      case "progress-dashboard":
        return <StudentProgressDashboard />;
      default:
        return <StudentDashboardView />;
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      <StudentSidebar activeTab={activeTab} onTabChange={handleTabChange} />
      <main className="flex-1 p-6 lg:p-8">
        <div className="flex justify-end mb-4">
          <NotificationsPopover onNavigate={handleTabChange} />
        </div>
        {renderContent()}
      </main>
    </div>
  );
};

export default StudentPortal;
