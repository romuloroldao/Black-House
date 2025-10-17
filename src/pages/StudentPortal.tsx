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
      case "progress":
        return <StudentProgressView />;
      case "financial":
        return <StudentFinancialView />;
      case "profile":
        return <StudentProfileView />;
      default:
        return <StudentDashboardView />;
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      <StudentSidebar activeTab={activeTab} onTabChange={handleTabChange} />
      <main className="flex-1 p-6 lg:p-8">
        {renderContent()}
      </main>
    </div>
  );
};

export default StudentPortal;
