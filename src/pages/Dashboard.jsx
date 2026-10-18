import DashboardBottom from "../components/Dashboard/DashboardBottom";
import DashboardTop from "../components/Dashboard/DashboardTop";
import DaoVotingPrompt from "../components/Dashboard/DaoVotingPrompt";

const Dashboard = () => {
  return (
    <div>
      <DaoVotingPrompt />
      <DashboardTop />
      <DashboardBottom />
    </div>
  );
};
export default Dashboard;
