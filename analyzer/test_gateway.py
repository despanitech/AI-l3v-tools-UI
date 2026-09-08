import tempfile,unittest
from concurrent.futures import ThreadPoolExecutor
from hermes_gateway import charge
class QuotaTest(unittest.TestCase):
 def test_atomic_daily_limit(self):
  with tempfile.TemporaryDirectory() as folder:
   db=folder+'/usage.sqlite'
   with ThreadPoolExecutor(max_workers=8) as pool:results=list(pool.map(lambda _:charge(db,'a'*64),range(12)))
   self.assertEqual(sum(results),3)
 def test_global_limit(self):
  with tempfile.TemporaryDirectory() as folder:
   db=folder+'/usage.sqlite'
   for i in range(200):self.assertTrue(charge(db,format(i,'064x')))
   self.assertFalse(charge(db,'b'*64))
if __name__=='__main__':unittest.main()
