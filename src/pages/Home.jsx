import React from "react";
import "../components/Home/Homepage/Homepage.css";
import { Navbar } from "../components/Home/Homepage/Navbar";
import { Hero } from "../components/Home/Homepage/Hero";
import { ArchitectureComparison } from "../components/Home/Homepage/ArchitectureComparison";
import { PackageShowcase } from "../components/Home/Homepage/PackageShowcase";
import { CompensationDeck } from "../components/Home/Homepage/CompensationDeck";
import { ContractVerification } from "../components/Home/Homepage/ContractVerification";
import { OnboardingSteps } from "../components/Home/Homepage/OnboardingSteps";
import { FAQ } from "../components/Home/Homepage/FAQ";
import { Footer } from "../components/Home/Homepage/Footer";

const Home = () => {
  return (
    <div id="main-content">
      <Navbar />
      <Hero />
      <ArchitectureComparison />
      <PackageShowcase />
      <CompensationDeck />
      <ContractVerification />
      <OnboardingSteps />
      <FAQ />
      <Footer />
    </div>
  );
};

export default Home;
