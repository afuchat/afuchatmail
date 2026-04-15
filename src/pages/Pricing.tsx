import { useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle, Shield, Sparkles, Users } from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { Button } from "@/components/ui/button";

const Pricing = () => {
  const navigate = useNavigate();

  const plans = [
    {
      name: "Starter",
      price: "Free",
      description: "For personal inboxes and lightweight professional use.",
      icon: Sparkles,
      features: ["1 primary @afuchat.com address", "Unlimited aliases", "Smart folders", "Push notifications", "PWA access"],
      cta: "Create account",
    },
    {
      name: "Professional",
      price: "Coming soon",
      description: "For creators, freelancers, and small teams that need more control.",
      icon: Users,
      features: ["Custom domain support", "Shared team aliases", "Advanced routing rules", "Priority support", "Higher sending limits"],
      cta: "Join waitlist",
    },
    {
      name: "Business",
      price: "Contact us",
      description: "For organizations that need security, compliance, and onboarding support.",
      icon: Shield,
      features: ["Admin controls", "Security reviews", "Dedicated onboarding", "SLA planning", "Integration guidance"],
      cta: "Contact sales",
    },
  ];

  return (
    <PageLayout title="Pricing">
      <section className="pb-10">
        <h1 className="mb-3 text-3xl font-black tracking-tight md:text-5xl">Simple pricing for professional email.</h1>
        <p className="max-w-2xl text-lg font-medium leading-8 text-muted-foreground">
          Start free, keep your inbox private, and upgrade when your workflow needs team-ready controls.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {plans.map((plan, index) => (
          <article key={plan.name} className="flex flex-col rounded-3xl border border-border bg-background p-6 shadow-xs">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
              <plan.icon className="h-5 w-5" />
            </div>
            <h2 className="text-2xl font-black">{plan.name}</h2>
            <p className="mt-2 text-3xl font-black text-primary" data-testid={`text-plan-price-${index}`}>{plan.price}</p>
            <p className="mt-3 min-h-16 text-sm font-medium leading-6 text-muted-foreground">{plan.description}</p>
            <ul className="mt-6 flex-1 space-y-3">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5 text-sm font-bold">
                  <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                  {feature}
                </li>
              ))}
            </ul>
            <Button
              className="mt-8 h-11 rounded-xl font-black shadow-none"
              variant={index === 0 ? "default" : "outline"}
              onClick={() => index === 2 ? navigate("/contact") : navigate("/auth")}
              data-testid={`button-plan-${index}`}
            >
              {plan.cta}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </article>
        ))}
      </section>

      <section className="mt-10 rounded-3xl border border-border bg-accent/40 p-6">
        <p className="text-xs font-black uppercase tracking-wider text-primary">Fair by design</p>
        <h2 className="mt-2 text-2xl font-black">The core mail experience stays free.</h2>
        <p className="mt-3 max-w-3xl text-sm font-medium leading-7 text-muted-foreground">
          Paid plans will focus on business controls, custom domains, and support. Your personal inbox, aliases, and privacy-first experience remain available without ads or tracking.
        </p>
      </section>
    </PageLayout>
  );
};

export default Pricing;