import StudentProgressDashboard from "@/components/student/StudentProgressDashboard";
import CoachCheckinTimeline from "@/components/coach/CoachCheckinTimeline";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, ListChecks } from "lucide-react";

type StudentProgressCoachTabsProps = {
  studentId: string;
  studentName: string;
};

export default function StudentProgressCoachTabs({
  studentId,
  studentName,
}: StudentProgressCoachTabsProps) {
  return (
    <Tabs defaultValue="checkins" className="w-full">
      <TabsList className="grid w-full max-w-md grid-cols-2">
        <TabsTrigger value="checkins" className="flex items-center gap-2">
          <ListChecks className="h-4 w-4" />
          Check-ins
        </TabsTrigger>
        <TabsTrigger value="analysis" className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Análise
        </TabsTrigger>
      </TabsList>
      <TabsContent value="checkins" className="mt-6">
        <CoachCheckinTimeline studentId={studentId} studentName={studentName} />
      </TabsContent>
      <TabsContent value="analysis" className="mt-6">
        <StudentProgressDashboard studentId={studentId} studentName={studentName} />
      </TabsContent>
    </Tabs>
  );
}
