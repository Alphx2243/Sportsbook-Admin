import {Card} from '@/components/ui/Card'
import {CardContent} from '@/components/ui/Card'
import {CardDescription} from '@/components/ui/Card'
const devs = [
  {
    name : "Kunal Budhiraja",
    email : "kunal24313@iiitd.ac.in",
  },
  {
    name : "Kirat Goel",
    email : "kirat24303@iiitd.ac.in",
  }
]
export default function ContactUs(){
    return (
        <div className='flex flex-col gap-8'>
            <h1 className='text-2xl font-bold'>Meet the developers</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {devs.map((details, i) => (
                <Card
                key={i}
                className="hover:bg-black/5 transition-colors border-white/5 dark:border-white/5 border-black/5"
                >
                <CardContent className="p-8">
                    <div className="mb-6 p-3  w-fit text-xl rounded-xl border-b border-white/10 shadow-inner">
                    {details.name}
                    </div>
                    <h3 className="text-md text-foreground mb-3">Contact- {details.email}</h3>
                </CardContent>
                </Card>
            ))}
            </div>
        </div>
    )
}